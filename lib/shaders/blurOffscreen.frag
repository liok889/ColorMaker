varying vec2 oTexCoord;
uniform sampler2D scalarField;
uniform sampler2D colormap;
uniform vec2 pitch;

const float GAUSS_WEIGHT=1.0/16.0;
const vec3 BLUR_KERNEL1 = vec3(1.0, 2.0, 1.0);
const vec3 BLUR_KERNEL2 = vec3(2.0, 4.0, 2.0);


void main()
{

	vec3 data1 = vec3(
		texture2D(scalarField, oTexCoord + vec2(-1.0, -1.0) * pitch).x,
		texture2D(scalarField, oTexCoord + vec2(-1.0,  0.0) * pitch).x,
		texture2D(scalarField, oTexCoord + vec2(-1.0, +1.0) * pitch).x
	);

	vec3 data2 = vec3(
		texture2D(scalarField, oTexCoord + vec2( 0.0, -1.0) * pitch).x,
		texture2D(scalarField, oTexCoord                           ).x,
		texture2D(scalarField, oTexCoord + vec2( 0.0, +1.0) * pitch).x
	);

	vec3 data3 = vec3(
		texture2D(scalarField, oTexCoord + vec2( 1.0, -1.0) * pitch).x,
		texture2D(scalarField, oTexCoord + vec2( 1.0,  0.0) * pitch).x,
		texture2D(scalarField, oTexCoord + vec2( 1.0, +1.0) * pitch).x
	);

	float val = GAUSS_WEIGHT * (
		dot(data1, BLUR_KERNEL1) +
		dot(data2, BLUR_KERNEL2) +
		dot(data3, BLUR_KERNEL1)
	);
	gl_FragColor = vec4(val);
}
