varying vec2 oTexCoord;
uniform sampler2D scalarField;
uniform sampler2D colormap;

void main()
{
    float pdfDensity = texture2D(scalarField, oTexCoord).x;
    float val = pdfDensity;
    gl_FragColor = texture2D(colormap, vec2(val, 0.5));
}
