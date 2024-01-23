varying vec2 oTexCoord;
uniform sampler2D scalarField;
uniform float randomSeed;

// Gold Noise 2015 dcerisano@standard3d.com
// - based on the Golden Ratio
// - uniform normalized distribution
// - fastest static noise generator function (also runs at low precision)
// - use with indicated seeding method.

const float PHI = 1.61803398874989484820459;  // Golden Ratio
const float P = 1.0 / 1.1;
const int SAMPLES = 20;
const float W = 1.0 / float(SAMPLES);


float gold_noise(in vec2 xy, in float seed){
       return fract(tan(distance(xy*PHI, xy)*seed)*xy.x);
}

void main()
{
    float pdfDensity = P * texture2D(scalarField, oTexCoord).x;
    float val = 0.0;
    float seed = randomSeed;


    for (int i = 0; i < SAMPLES; i++)
    {
        float r = gold_noise(gl_FragCoord.xy, fract(seed) + 1.0);
        val += (r < pdfDensity ? W : 0.0);
        seed = r;
    }

    gl_FragColor = vec4(val);
}
