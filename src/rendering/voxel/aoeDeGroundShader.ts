// The Natural style's ground shader (spec §14.5; the de-look plan's step 2), spliced into Three's Lambert
// material so the ground is lit by exactly the lights, tone curve and colour encoding that light the models.
//
// Per fragment it reads the 3x3 cells around it (the cell texture, packed by aoeDeGroundData.ts) and:
//   * blends the surfaces of the four nearest cell centres. The weights are bilinear, then sharpened, and the
//     line between two surfaces is moved by each surface's texture "height" and by a tile-sized wander field,
//     so it is soft and irregular and follows no tile edge. Water moves its line least, because the water's
//     ripple parts (aoeVoxelTerrainWaterDetail.ts) sit inside the water tiles;
//   * lays sand on land within about half a tile of water, lightens water near land, and lays dirt around
//     building footprints (the cell texture's dirt channel);
//   * leaves a cell the player has never explored black, and fades known ground to black beside one, over
//     about 0.7 of a tile (0.54 to 1.0 as the wander field moves it). Nothing in an unexplored cell is ever
//     read, because nothing about it is packed;
//   * darkens explored-but-unseen ground to the style's level through the linearly filtered fields texture's fog
//     level, so the edge of vision is a gradient that reaches at most half a tile past the visible cells.
// Every surface is sampled with explicit gradients, because a mipmapped lookup inside a branch has no
// derivatives of its own.
//
// That is the BLEND, which a graphics card draws. Where the renderer is a CPU rasteriser the material defines
// DE_GROUND_SINGLE_SAMPLE and the ground draws one surface sample per pixel instead (aoeDeGroundTier.ts says
// why and how the renderer is told apart; the tier's own comment below says what it draws).

import type { WebGLProgramParametersWithUniforms } from 'three';

import { DE_GROUND_KIND_CODE } from './aoeDeGroundData';
import {
  DE_GROUND_DETAIL_SIZE,
  DE_GROUND_DETAIL_SPAN,
  DE_GROUND_LAYERS,
  DE_GROUND_MACRO_SPAN,
} from './aoeDeGroundDetail';

/** Bumped whenever the GLSL below changes, so Three compiles the new program rather than reusing a cached one. */
export const DE_GROUND_PROGRAM_KEY = 'aoe2-de-ground-2';

function layerIndex(layer: (typeof DE_GROUND_LAYERS)[number]): string {
  return `${String(DE_GROUND_LAYERS.indexOf(layer))}.0`;
}

const VERTEX_PARS = /* glsl */ `
varying vec3 vDeWorld;
varying vec3 vDeNormal;
`;

const VERTEX_BODY = /* glsl */ `
vDeWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vDeNormal = normalize( mat3( modelMatrix ) * objectNormal );
`;

const FRAGMENT_PARS = /* glsl */ `
uniform sampler2D deCells;
uniform sampler2D deFields;
uniform sampler2DArray deDetail;
uniform sampler2D deMacro;
uniform vec2 deMapSize;
varying vec3 vDeWorld;
varying vec3 vDeNormal;

const int DE_GRASS = ${String(DE_GROUND_KIND_CODE.grass)};
const int DE_FOREST = ${String(DE_GROUND_KIND_CODE.forest)};
const int DE_HILL = ${String(DE_GROUND_KIND_CODE.hill)};
const int DE_WATER = ${String(DE_GROUND_KIND_CODE.water)};
const float DE_LAYER_GRASS = ${layerIndex('grass')};
const float DE_LAYER_FOREST = ${layerIndex('forest')};
const float DE_LAYER_HILL = ${layerIndex('hill')};
const float DE_LAYER_WATER = ${layerIndex('water')};
const float DE_LAYER_SAND = ${layerIndex('sand')};
const float DE_LAYER_DIRT = ${layerIndex('dirt')};
const float DE_DETAIL_SPAN = ${DE_GROUND_DETAIL_SPAN.toFixed(1)};
const float DE_DETAIL_SIZE = ${DE_GROUND_DETAIL_SIZE.toFixed(1)};
const float DE_MACRO_SPAN = ${DE_GROUND_MACRO_SPAN.toFixed(1)};

// Past the map's edge the edge cell continues, so the ground runs to the edge and down the slab's side as the
// voxel terrain does. An unexplored edge cell continues unexplored.
vec4 deCellAt( ivec2 cell ) {
	return texelFetch( deCells, clamp( cell, ivec2( 0 ), ivec2( deMapSize ) - 1 ), 0 );
}

int deKindOf( vec4 cell ) {
	return int( cell.r * 255.0 + 0.5 );
}

vec4 deSurface( float layer, vec2 uv, vec2 gx, vec2 gy ) {
	return textureGrad( deDetail, vec3( uv, layer ), gx, gy );
}

float deLayerOf( int kind ) {
	return kind == DE_GRASS ? DE_LAYER_GRASS
		: kind == DE_FOREST ? DE_LAYER_FOREST
		: kind == DE_HILL ? DE_LAYER_HILL
		: DE_LAYER_WATER;
}

// A surface's colour before sand and dirt: its texel, varied over the map by the macro field. shallow (0 to 1) is
// how near known land a water fragment is; water lightens there.
vec3 deTinted( int kind, vec3 texel, vec4 macro, float shallow ) {
	if ( kind == DE_GRASS ) return texel * ( mix( vec3( 0.9, 1.0, 0.9 ), vec3( 1.1, 1.03, 0.84 ), macro.r ) * ( 0.9 + 0.2 * macro.g ) );
	if ( kind == DE_HILL ) return texel * ( mix( vec3( 0.95, 1.0, 0.95 ), vec3( 1.05, 1.02, 0.9 ), macro.r ) * ( 0.92 + 0.16 * macro.g ) );
	if ( kind == DE_FOREST ) return texel * ( 0.88 + 0.24 * macro.g );
	vec3 surface = texel * ( 0.86 + 0.28 * macro.r );
	return mix( surface, surface * vec3( 1.25, 1.35, 1.3 ), shallow * 0.6 );
}

#ifdef DE_GROUND_SINGLE_SAMPLE

// ONE SURFACE SAMPLE PER PIXEL, the tier for a CPU rasteriser (aoeDeGroundTier.ts). A fragment reads its own cell
// and the linearly filtered fields (aoeDeGroundData.ts) in place of the 3x3 the blend reads, and draws one surface:
// dirt where the dirt field passes a half (about half a tile past a footprint, as the blend's dirt), sand on land
// within about a quarter of a tile of known water, and otherwise its own cell's kind. So the line between two
// kinds is the tile edge, and sand and dirt have hard edges. The fog is the blend's, as near as a filtered field
// gets it. An unexplored cell is black, and the explored level is the same filtered byte. Known ground fades to
// black over the half tile beside an unexplored cell's edge: the known field runs from 1 at a known cell's centre
// to a half at that edge, and the fade is the square of its smoothstep, so it is about a quarter at a quarter tile,
// as the blend's is. At an inner corner of the rim, where an unexplored cell meets a known diagonal, the field
// reads three quarters, so the known ground there reaches a quarter of full brightness against the black cell;
// the blend, which measures the distance to the cell, draws black there.
//
// What it costs on SwiftShader decides two things here. The surface is read at a mip level worked out from the
// fragment's own derivatives, as a rasteriser works it out for an implicit read: SwiftShader's explicit-gradient read
// cost 0.18 of Moebius's whole frame more (800x600, four CPUs, 2026-09-25). And the read sits in a loop that a
// fragment in an unexplored cell never enters, because SwiftShader skips a loop that none of a quad's four fragments
// enters (an if costs as much as the work it skips there), so unexplored ground, which is black, reads no surface.
vec4 deGround( vec2 p, vec2 gx, vec2 gy ) {
	int kind = deKindOf( deCellAt( ivec2( floor( p ) ) ) );
	// r the fog level, g known, b dirt, a known water.
	vec4 field = textureLod( deFields, p / deMapSize, 0.0 );
	vec4 macro = textureLod( deMacro, p / DE_MACRO_SPAN, 0.0 );
	bool land = kind != DE_WATER;
	bool dirt = land && field.b + ( macro.a - 0.5 ) * 0.3 > 0.5;
	bool sand = land && !dirt && field.a + ( macro.b - 0.5 ) * 0.16 > 0.25;
	vec2 uv = p / DE_DETAIL_SPAN;
	vec2 texels = uv * DE_DETAIL_SIZE;
	vec2 dx = dFdx( texels );
	vec2 dy = dFdy( texels );
	float lod = 0.5 * log2( max( dot( dx, dx ), dot( dy, dy ) ) );
	vec4 texel = vec4( 0.0 );
	for ( int known = kind == 0 ? 0 : 1; known > 0; known -- ) {
		texel = textureLod( deDetail, vec3( uv, dirt ? DE_LAYER_DIRT : sand ? DE_LAYER_SAND : deLayerOf( kind ) ), lod );
	}
	// Sand darkens toward the waterline, as the blend's does.
	vec3 colour = dirt ? texel.rgb
		: sand ? texel.rgb * mix( 0.72, 1.0, smoothstep( 0.0, 0.18, 0.5 - field.a ) )
		: deTinted( kind, texel.rgb, macro, smoothstep( 0.0, 0.5, field.g - field.a ) );
	float level = pow( field.r, 2.2 );
	float edge = smoothstep( 0.5, 1.0, field.g );
	float fade = kind == 0 ? 0.0 : edge * edge;
	return vec4( colour, level * fade );
}

#else

// Distance from the fragment (local position f in its own cell) to neighbour cell (dx, dy).
float deCellDistance( vec2 f, int dx, int dy ) {
	vec2 lo = vec2( float( dx ), float( dy ) );
	vec2 gap = max( max( lo - f, f - ( lo + 1.0 ) ), 0.0 );
	return length( gap );
}

// rgb: linear albedo; a: how bright the fog leaves this ground.
vec4 deGround( vec2 p, vec2 gx, vec2 gy ) {
	ivec2 own = ivec2( floor( p ) );
	vec2 f = p - vec2( own );
	int kinds[ 9 ];
	float dirts[ 9 ];
	for ( int j = 0; j < 3; j ++ ) {
		for ( int i = 0; i < 3; i ++ ) {
			vec4 cell = deCellAt( own + ivec2( i - 1, j - 1 ) );
			kinds[ j * 3 + i ] = deKindOf( cell );
			dirts[ j * 3 + i ] = cell.g;
		}
	}
	int ownKind = kinds[ 4 ];
	if ( ownKind == 0 ) return vec4( 0.0 );

	// Fog: distance to the nearest unexplored neighbour, and to the nearest water and land (known cells only).
	float toUnknown = 2.0;
	float toWater = 2.0;
	float toLand = 2.0;
	for ( int j = 0; j < 3; j ++ ) {
		for ( int i = 0; i < 3; i ++ ) {
			int kind = kinds[ j * 3 + i ];
			float d = deCellDistance( f, i - 1, j - 1 );
			if ( kind == 0 ) toUnknown = min( toUnknown, d );
			else if ( kind == DE_WATER ) toWater = min( toWater, d );
			else toLand = min( toLand, d );
		}
	}

	vec2 uv = p / DE_DETAIL_SPAN;
	vec4 macro = textureLod( deMacro, p / DE_MACRO_SPAN, 0.0 );

	// The four nearest cell centres and their bilinear weights. An unexplored one takes no part: the known
	// ones share its weight, so the blend never turns toward it. (The fragment's own cell is always one of
	// the four, with a weight of at least a quarter.) Every weight reaches zero where a cell leaves the four,
	// so nothing jumps along the lines between cell centres.
	vec2 q = p - 0.5;
	ivec2 base = ivec2( floor( q ) ) - own + 1;
	vec2 w = q - floor( q );
	vec4 kindWeight = vec4( 0.0 );
	float dirt = 0.0;
	float known = 0.0;
	for ( int c = 0; c < 4; c ++ ) {
		int ci = base.x + ( c & 1 );
		int cj = base.y + ( c >> 1 );
		int kind = kinds[ cj * 3 + ci ];
		if ( kind == 0 ) continue;
		float weight = ( ( c & 1 ) == 1 ? w.x : 1.0 - w.x ) * ( ( c >> 1 ) == 1 ? w.y : 1.0 - w.y );
		kindWeight[ kind - 1 ] += weight;
		dirt += weight * dirts[ cj * 3 + ci ];
		known += weight;
	}
	kindWeight /= known;
	dirt /= known;

	// Sand within about half a tile of water, and dirt around buildings, lie over every land surface; water
	// surfaces keep neither, so the blend below decides where they stop.
	float wander = macro.b - 0.5;
	vec4 sandTexel = vec4( 0.0 );
	float sand = 0.0;
	if ( toWater < 0.5 ) {
		sandTexel = deSurface( DE_LAYER_SAND, uv, gx, gy );
		sand = 0.85 * ( 1.0 - smoothstep( 0.04, 0.32, toWater + ( sandTexel.a - 0.5 ) * 0.16 + wander * 0.16 ) );
		sandTexel.rgb *= mix( 0.72, 1.0, smoothstep( 0.0, 0.18, toWater ) );
	}
	vec4 dirtTexel = vec4( 0.0 );
	float dirtAmount = 0.0;
	if ( dirt > 0.12 ) {
		dirtTexel = deSurface( DE_LAYER_DIRT, uv, gx, gy );
		dirtAmount = smoothstep( 0.4, 0.6, dirt + ( dirtTexel.a - 0.5 ) * 0.25 + ( macro.a - 0.5 ) * 0.3 );
	}

	// Each surface present: its texel, and a score whose soft maximum picks the surface.
	vec3 colour = vec3( 0.0 );
	float total = 0.0;
	// Near water the line moves less, so a shore stays close to its tile edge and off the water's ripple parts.
	float nearWater = min( 1.0, kindWeight[ DE_WATER - 1 ] * 2.0 );
	float heightReach = mix( 0.34, 0.12, nearWater );
	float wanderReach = mix( 0.36, 0.08, nearWater );
	float shallow = 1.0 - smoothstep( 0.0, 0.9, toLand );
	for ( int k = 0; k < 4; k ++ ) {
		if ( kindWeight[ k ] <= 0.0 ) continue;
		int kind = k + 1;
		vec4 texel = deSurface( deLayerOf( kind ), uv, gx, gy );
		float height = kind == DE_WATER ? 0.5 : texel.a;
		float score = kindWeight[ k ] + ( height - 0.5 ) * heightReach + wander * ( kind == DE_WATER ? 0.06 : wanderReach );
		vec3 surface = deTinted( kind, texel.rgb, macro, shallow );
		if ( kind != DE_WATER ) {
			surface = mix( mix( surface, sandTexel.rgb, sand ), dirtTexel.rgb, dirtAmount );
		}
		// Scaled by the weight itself, so a surface leaving the four nearest fades out rather than vanishing.
		float e = kindWeight[ k ] * exp( 12.0 * score );
		colour += surface * e;
		total += e;
	}
	colour /= total;

	// The style's explored level scales the sRGB colour, as the voxel ground's shade() of a cell's tint does and
	// as step 1 measured it (0.6 there drew explored grass at 0.506 of visible), so it becomes a linear factor.
	float level = pow( textureLod( deFields, p / deMapSize, 0.0 ).r, 2.2 );
	// The fade ends where the distance times its wander factor (0.7 to 1.3) reaches 0.7, so always within a
	// tile: a cell outside the 3x3, a tile or more away, could not change it, and nothing jumps where the 3x3
	// moves on.
	float fade = smoothstep( 0.0, 0.7, toUnknown * ( 1.0 + ( macro.a - 0.5 ) * 0.6 ) );
	return vec4( colour, level * fade );
}

#endif
`;

const FRAGMENT_BODY = /* glsl */ `
vec2 deGroundPoint = vDeWorld.xz - vDeNormal.xz * 0.02;
vec2 deGroundUv = deGroundPoint / DE_DETAIL_SPAN;
vec4 deGroundSample = deGround( deGroundPoint, dFdx( deGroundUv ), dFdy( deGroundUv ) );
diffuseColor.rgb *= deGroundSample.rgb * deGroundSample.a;
`;

function splice(source: string, anchor: string, insert: string, where: 'before' | 'after', stage: string): string {
  const at = source.indexOf(anchor);
  if (at < 0 || source.indexOf(anchor, at + anchor.length) >= 0) {
    throw new Error(
      `The Natural ground shader splices into Three's Lambert ${stage} shader at "${anchor}", which appears `
      + `${at < 0 ? 'nowhere' : 'more than once'} in it. Three's shader chunks changed: update aoeDeGroundShader.ts.`,
    );
  }
  return where === 'before'
    ? `${source.slice(0, at)}${insert}\n${source.slice(at)}`
    : `${source.slice(0, at + anchor.length)}\n${insert}${source.slice(at + anchor.length)}`;
}

/** The uniforms the ground shader reads; the ground owns the objects and swaps their values in place. */
export interface DeGroundUniforms {
  readonly deCells: { value: unknown };
  readonly deFields: { value: unknown };
  readonly deDetail: { value: unknown };
  readonly deMacro: { value: unknown };
  readonly deMapSize: { value: { x: number; y: number } };
}

/** Rewrites a MeshLambertMaterial's program into the ground's. Used as its `onBeforeCompile`. */
export function spliceDeGroundShader(shader: WebGLProgramParametersWithUniforms, uniforms: DeGroundUniforms): void {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = splice(
    splice(shader.vertexShader, 'void main() {', VERTEX_PARS, 'before', 'vertex'),
    '#include <worldpos_vertex>',
    VERTEX_BODY,
    'after',
    'vertex',
  );
  shader.fragmentShader = splice(
    splice(shader.fragmentShader, 'void main() {', FRAGMENT_PARS, 'before', 'fragment'),
    '#include <color_fragment>',
    FRAGMENT_BODY,
    'after',
    'fragment',
  );
}
