varying vec2 oTexCoord;
uniform sampler2D scalarField;
uniform sampler2D colormap;
uniform float minValue;
uniform float normTerm;

void main()
{
	float data = texture2D(scalarField, oTexCoord).x;
	if (data < -0.5)
	{
		gl_FragColor = vec4(1.0);
	}
	else
	{
		vec2 colormapCoord = vec2((data - minValue) * normTerm, 0.5);
		gl_FragColor = texture2D(colormap, colormapCoord);
	}
}
