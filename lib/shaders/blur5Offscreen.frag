varying vec2 oTexCoord;
uniform sampler2D scalarField;
uniform sampler2D colormap;
uniform vec2 pitch;

const float GAUSS_WEIGHT=1.0/273.0;

#define T(r,c) texture2D(scalarField, oTexCoord + vec2(float(r), float(c)) * pitch).x

#define ROW1 T(-2, -2)*1.0 + T(-2, -1)*4.0  + T(-2, 0)*7.0  + T(-2, +1)*4.0  + T(-2, +2)*1.0
#define ROW2 T(-1, -2)*4.0 + T(-1, -1)*16.0 + T(-1, 0)*26.0 + T(-1, +1)*16.0 + T(-1, +2)*4.0
#define ROW3 T( 0, -2)*7.0 + T(0 , -1)*26.0 + T(0 , 0)*41.0 + T(0 , +1)*26.0 + T(0 , +2)*7.0
#define ROW4 T( 1, -2)*4.0 + T(+1, -1)*16.0 + T(+1, 0)*26.0 + T(+1, +1)*16.0 + T(+1, +2)*4.0
#define ROW5 T( 2, -2)*1.0 + T(+2, -1)*4.0  + T(+2, 0)*7.0  + T(+2, +1)*4.0  + T(-2, +2)*1.0

void main()
{
	float val = (ROW1 + ROW2 + ROW3 + ROW4 + ROW5) * GAUSS_WEIGHT;
	gl_FragColor = vec4(val);
}
