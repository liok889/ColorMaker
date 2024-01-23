var noiseOffset = [0, 0];
var noiseZoom = 1;
var noiseSimplex = false;
var inversion = false;

var exponentWeight = 2.0;
var noiseScale = 4;
var noiseWeights = [1, 0.75, 0.3/2, 0.1/3, 0.05/5];
var noiseOctaves = [1, 2, 4, 8, 16];

var noiseFunc = function(x, y)
{
	var theNoise = noiseSimplex ? noise.simplex2 : noise.perlin2;
	return (inversion ? -1 : 1) * theNoise(x, y)
}

function setNoiseOffset(x, y) {
	noiseOffset[0] = x;
	noiseOffset[1] = y;
}

function setExponentWeight(e) {
	exponentWeight = e;
}

function getExponentWeight() {
	return exponentWeight;
}

function noiseGenerate(x, y, w, h)
{
	var nx = noiseScale*((x + noiseOffset[0])/(w-1) - 0.5);
	var ny = noiseScale*((y + noiseOffset[1])/(h-1) - 0.5);
	var e =
		noiseWeights[0] * (.5 + .5 * noiseFunc(noiseOctaves[0] * nx, noiseOctaves[0] * ny)) +
		noiseWeights[1] * (.5 + .5 * noiseFunc(noiseOctaves[1] * nx, noiseOctaves[1] * ny)) +
		noiseWeights[2] * (.5 + .5 * noiseFunc(noiseOctaves[2] * nx, noiseOctaves[2] * ny));
		//noiseWeights[3] * (.5 + .5 * noiseFunc(noiseOctaves[3] * nx, noiseOctaves[3] * ny)) +
		//noiseWeights[4] * (.5 + .5 * noiseFunc(noiseOctaves[4] * nx, noiseOctaves[4] * ny)) ;
	return Math.pow(e, exponentWeight);
}

function makeNoise(scalarField, _noiseScale, _exponentWeight)
{
	//console.log("noiseScale: " + noiseScale);
	setNoiseOffset(Math.random()*10, Math.random()*10);

	var data = scalarField.view;
	var w = scalarField.w;
	var h = scalarField.h;
	var I = 0;

	if (_noiseScale && !isNaN(_noiseScale)) {
		noiseScale = _noiseScale;
	}

	if (_exponentWeight && !isNaN(_exponentWeight)) {
		exponentWeight = _exponentWeight;
	}

	/*
	noiseOffset[0] /= noiseScale / noiseZoom;
	noiseOffset[1] /= noiseScale / noiseZoom;
	noiseZoom = noiseScale;
	*/

	for (var y=0; y<h; y++)
	{
		for (var x=0; x<w; x++)
		{
			var nx = noiseScale*((x + noiseOffset[0])/(w-1) - 0.5);
			var ny = noiseScale*((y + noiseOffset[1])/(h-1) - 0.5);
			var e =
				noiseWeights[0] * (.5 + .5*noise.simplex2(noiseOctaves[0] * nx, noiseOctaves[0] * ny)) +
				noiseWeights[1] * (.5 + .5*noise.simplex2(noiseOctaves[1] * nx, noiseOctaves[1] * ny)) +
				noiseWeights[2] * (.5 + .5*noise.simplex2(noiseOctaves[2] * nx, noiseOctaves[2] * ny));
				//noiseWeights[3] * (.5 + .5*noise.simplex2(noiseOctaves[3] * nx, noiseOctaves[3] * ny));
				//noiseWeights[4] * (.5 + .5*noise.simplex2(noiseOctaves[4] * nx, noiseOctaves[4] * ny)) ;
				data[I++] = Math.pow(e, exponentWeight);
		}
	}
	scalarField.normalize(); scalarField.generated = true; originalField = scalarField;
	//visualizeScalarField();
	//analyzeImage();
}

function seedNoise() {
	var theSeed = Math.random()
	noise.seed(theSeed);
	return theSeed;
}
