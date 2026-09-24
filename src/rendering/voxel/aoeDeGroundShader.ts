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
//   * leaves a cell the player has never explored black, and fades known ground to black over the half tile
//     next to one. Nothing in an unexplored cell is ever read, because nothing about it is packed;
//   * darkens explored-but-unseen ground to the style's level through the linearly filtered fog texture, so
//     the edge of vision is a gradient that reaches at most half a tile past the visible cells.
// Every surface is sampled with explicit gradients, because a mipmapped lookup inside a branch has no
// derivatives of its own.

import type { WebGLProgramParametersWithUniforms } from 'three';

import { DE_GROUND_KIND_CODE } from './aoeDeGroundData';
import { DE_GROUND_DETAIL_SPAN, DE_GROUND_LAYERS, DE_GROUND_MACRO_SPAN } from './aoeDeGroundDetail';

/** Bumped whenever the GLSL below changes, so Three compiles the new program rather than reusing a cached one. */
export const DE_GROUND_PROGRAM_KEY = 'aoe2-de-ground-1';

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
uniform sampler2D deFog;
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
	for ( int k = 0; k < 4; k ++ ) {
		if ( kindWeight[ k ] <= 0.0 ) continue;
		int kind = k + 1;
		float layer = kind == DE_GRASS ? DE_LAYER_GRASS
			: kind == DE_FOREST ? DE_LAYER_FOREST
			: kind == DE_HILL ? DE_LAYER_HILL
			: DE_LAYER_WATER;
		vec4 texel = deSurface( layer, uv, gx, gy );
		float height = kind == DE_WATER ? 0.5 : texel.a;
		float score = kindWeight[ k ] + ( height - 0.5 ) * heightReach + wander * ( kind == DE_WATER ? 0.06 : wanderReach );
		vec3 surface = texel.rgb;
		if ( kind == DE_GRASS ) {
			surface *= mix( vec3( 0.9, 1.0, 0.9 ), vec3( 1.1, 1.03, 0.84 ), macro.r ) * ( 0.9 + 0.2 * macro.g );
		} else if ( kind == DE_HILL ) {
			surface *= mix( vec3( 0.95, 1.0, 0.95 ), vec3( 1.05, 1.02, 0.9 ), macro.r ) * ( 0.92 + 0.16 * macro.g );
		} else if ( kind == DE_FOREST ) {
			surface *= 0.88 + 0.24 * macro.g;
		} else {
			surface *= 0.86 + 0.28 * macro.r;
			float shallow = 1.0 - smoothstep( 0.0, 0.9, toLand );
			surface = mix( surface, surface * vec3( 1.25, 1.35, 1.3 ), shallow * 0.6 );
		}
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
	float level = pow( textureLod( deFog, p / deMapSize, 0.0 ).r, 2.2 );
	// The fade ends where the distance times its wander factor (0.7 to 1.3) reaches 0.7, so always within a
	// tile: a cell outside the 3x3, a tile or more away, could not change it, and nothing jumps where the 3x3
	// moves on.
	float fade = smoothstep( 0.0, 0.7, toUnknown * ( 1.0 + ( macro.a - 0.5 ) * 0.6 ) );
	return vec4( colour, level * fade );
}
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
  readonly deFog: { value: unknown };
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
