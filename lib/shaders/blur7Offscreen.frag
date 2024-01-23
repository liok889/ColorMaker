varying vec2 oTexCoord;
uniform sampler2D scalarField;
uniform sampler2D colormap;
uniform vec2 pitch;

const float GAUSS_WEIGHT = 1.0 / 1003.0;

#define T(k,l) texture2D(scalarField, oTexCoord + vec2(float(k), float(l)) * pitch).x

#define ROW(r, c1, c2, c3, c4, c5, c6, c7) (T(r, -3)*float(c1) + T(r, -2)*float(c2) + T(r, -1)*float(c3) + T(r, 0)*float(c4) + T(r, +1)*float(c5) + T(r, +2)*float(c6) + T(r, +3)*float(c7))


#define ROW1 ROW(-3, 0, 0 , 1 , 2  , 1 , 0 , 0)
#define ROW2 ROW(-2, 0, 3 , 13, 22 , 13, 3 , 0)
#define ROW3 ROW(-1, 1, 13, 59, 97 , 59, 13, 1)
#define ROW4 ROW( 0, 2, 22, 97, 159, 97, 22, 2)
#define ROW5 ROW(+1, 1, 13, 59, 97 , 59, 13, 1)
#define ROW6 ROW(+2, 0, 3 , 13, 22 , 13, 3 , 0)
#define ROW7 ROW(+3, 0, 0 , 1 , 2  , 1 , 0 , 0)

void main()
{
	float val = (ROW1 + ROW2 + ROW3 + ROW4 + ROW5 + ROW6 + ROW7) *  GAUSS_WEIGHT;
	gl_FragColor = vec4(val);
}
