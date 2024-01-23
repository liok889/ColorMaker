// empty cell
var SCALAR_EMPTY = -99.0;

if (!ArrayBuffer.prototype.slice)
	ArrayBuffer.prototype.slice = function (start, end) {
	var that = new Uint8Array(this);
	if (end == undefined) end = that.length;
	var result = new ArrayBuffer(end - start);
	var resultArray = new Uint8Array(result);
	for (var i = 0; i < resultArray.length; i++) {
		resultArray[i] = that[i + start];
	}
	return result;
}

function checkWebGL()
{
	var canvas;
	var ctx;
	var exts;

	try {
	  canvas = document.createElement('canvas');
	  ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
	  exts = ctx.getSupportedExtensions();
	}
	catch (e) {
	  return false;
	}
	return exts;
}
function checkFLoatingTexture(ext)
{
	if (!ext) {
		ext = checkWebGL();
	}
	if (!ext) {
		return false;
	}
	else {
		for (var i=0, len=ext.length; i<len; i++) {
			var e = ext[i];
			if (e.search('texture_float') >= 0) {
				return true;
			}
		}
		return false;
	}
}

/*
 * Utility for finding kth order statistic for an array
 * from: http://marcodiiga.github.io/kth-order-statistic
 */

function swap(vec, i, j)
{
  var t = vec[i];
  vec[i] = vec[j];
  vec[j] = t;
}

function partition(vec, left, right, pivot)
{
  swap(vec, pivot, left); // No-op if pivot is the first one
  pivot = left;
  i = left;
  j = right + 1;

  while (i < j)
  {
    while (++i < j && vec[i] < vec[pivot]);
    while (--j >= i && vec[j] >= vec[pivot]); // Beware: tricky indices
    if (i <= j) {
      swap(vec, i, j);
    }
  }

  swap(vec, pivot, j);
  return j;
}

function quickSelect(vec, left, right, k)
{

  if (left == right)
    return vec[left];

  // Calculate the median of medians and return its index in the original vector
  var N = right - left + 1;
  function findMedian(subgroup)
  {
    subgroup.sort(function(x,y){return x-y});
    return subgroup[Math.floor(subgroup.length / 2)];
  };

  var medians = [];
  for (var i = 0, len=Math.floor((N+4)/5); i < len; ++i)
  {
    var elements = 5;
    if (i * 5 + 5 > N) {
      elements = N % 5;
    }
    var subgroup = [];
    for (var it = 0 + left + i * 5;
    it != 0 + left + i * 5 + elements; ++it) {
      subgroup.push(vec[it]);
    }
    medians.push(findMedian(subgroup));
  }

  // Now find the median of medians via quickselect
  var medianOfMedians = (medians.length == 1) ? medians[0] :
    quickSelect(medians, 0, medians.length - 1,
      Math.floor(medians.length / 2));

  // Find its original index
  var medianOfMediansIndex;
  for (var i = 0, vLen = vec.length; i < vLen; ++i) {
    if (vec[i] == medianOfMedians) {
      medianOfMediansIndex = i;
      break;
    }
  }

  var pivot = medianOfMediansIndex; // Use it as a pivot
  var mid = partition(vec, left, right, pivot);

  if (k - 1 == mid)
    return vec[mid];

  if (k - 1 < mid) {
    return quickSelect(vec, left, mid - 1, k);
  }
  else {
    return quickSelect(vec, mid + 1, right, k);
  }
}

function findKthOrderStatistic(vec, k) {
  return quickSelect(vec, 0, vec.length - 1, k);
}


/* ---------------
 * ScalarField
 * --------------- */

function ScalarField(width, height, doublePrecision)
{
	if (width && height)
	{
		this.w = width;
		this.h = height;
	}
	else {
		this.w = 0;
		this.h = 0;
	}

	var bytesPerPixel = doublePrecision ? 8 : 4;

	if (this.w && this.h)
	{
		// create a buffer

		this.buffer = new ArrayBuffer(bytesPerPixel * this.w * this.h);
		this.view = doublePrecision ? new Float64Array(this.buffer) : new Float32Array(this.buffer);
	}
	this.bytesPerPixel = bytesPerPixel;
	this.doublePrecision = (doublePrecision ? true : false);
	this.contour = -1;
}

ScalarField.prototype.copyView = function()
{
	var newBuffer = this.buffer.slice(0);
	return this.doublePrecision ?
		new Float64Array(newBuffer) : new Float32Array(newBuffer);
}

ScalarField.prototype.setMask = function(theMask)
{
	this.mask = theMask;
}

ScalarField.prototype.getMaskedW = function() {
	if (this.mask) {
		return Math.min(this.w, this.mask[0]);
	}
	else
	{
		return this.w;
	}
}
ScalarField.prototype.getMaskedH = function()
{
	if (this.mask) {
		return Math.min(this.h, this.mask[1]);
	}
	else
	{
		return this.h;
	}
}


ScalarField.prototype.duplicate = function()
{
	var field = this.view;
	var newScalar = new ScalarField(this.w, this.h);
	var newField = newScalar.view;

	for (var i=0, len=field.length; i<len; i++)
	{
		newField[i] = field[i];
	}

	if (this.minmax) {
		newScalar.minmax = [
			this.minmax[0], this.minmax[1]
		];
	}

	if (this.colorMap) {
		newScalar.setColorMap(this.colorMap);
	}

	return newScalar;
}

ScalarField.prototype.zero = function()
{
	for (var i=0, len=this.w*this.h; i<len; i++) {
		this.view[i] = 0;
	}
}

ScalarField.prototype.zeroLeaveEmpty = function()
{
	var view = this.view;
	var empty = SCALAR_EMPTY
	for (var i=0, len=this.w*this.h; i<len; i++)
	{
		if (view[i] != empty) {
			view[i] = 0;
		}
	}
}


function lerp(s, e, t) {return s+(e-s)*t;}
function blerp(c00, c10, c01, c11, tx, ty)
{
	return lerp(lerp(c00, c10, tx), lerp(c01, c11, tx), ty);
}

ScalarField.prototype.crop = function(x, y, w, h)
{
	x0 = Math.max(0, x);
	y0 = Math.max(0, y);
	x1 = Math.min(this.w, x0+w);
	y1 = Math.min(this.h, y0+h);

	var newBuffer = new ArrayBuffer(this.bytesPerPixel * (x1-x0) * (y1-y0));
	var newView = this.doublePrecision ?
		new Float64Array(newBuffer) : new Float32Array(newBuffer);
	var view = this.view;

	for (var y=y0, I=0; y<y1; y++)
	{
	    for (var x=x0; x<x1; x++)
	    {
	    	newView[I++] = view[ y*this.w + x ]
	    }
	}

	this.w = x1-x0;
	this.h = y1-y0;
	this.view = newView;
	this.buffer = newBuffer;
}

ScalarField.prototype.guassian = function(kernelSize, proceduralFunc)
{
	console.log("guassian, kernelSize: " + kernelSize);
	var w = this.w, h = this.h;

	// create kernel
	var kernel = [], kernelLen = kernelSize * 2 + 1;
	kernel.length = kernelLen * kernelLen;

	// set guassian parameter so that the middle
	// 3 delta = kernelSize -> delta = kernelSize / 3
	var delta = kernelSize / 3;
	var deltaSq = 2 * delta * delta;
	var totalDensity = 0;

	for (var r=0; r<kernelLen; r++)
	{
		for (var c=0; c<kernelLen; c++)
		{
			var e = Math.exp( -(Math.pow(c-kernelSize, 2)/deltaSq + Math.pow(r-kernelSize, 2)/deltaSq) );
			kernel[ r*kernelLen + c ] = e;
			totalDensity += e;
		}
	}

	// noramlize so that the kernel's density is a total of 1.0
	for (var i=0; i<kernel.length; i++) {
		kernel[i] /= totalDensity;
	}

	var field = this.view;
	var newScalar = new ScalarField(w, h);
	var newField = newScalar.view;
	var maxP = -Number.MAX_VALUE, minP = Number.MAX_VALUE;
	var originalMinMax = this.originalMinMax;

	// apply the kernel
	for (var r=0; r < h; r++)
	{
		for (var c=0; c < w; c++)
		{
			var p = 0.0;
			if ((!proceduralFunc) && (r < kernelSize  || r >= (h - kernelSize) || c < kernelSize || c >= (w - kernelSize)))
			{
				p = field[r*w + c];
				newField[r*w + c] = p;
				maxP = Math.max(p, maxP);
				minP = Math.min(p, minP)
			}
			else
			{
				var k = 0;
				for (var kr=-kernelSize; kr<= kernelSize; kr++)
				{
					for (var kc=-kernelSize; kc<=kernelSize; kc++)
					{
						var y = r+kr, x = c+kc;
						var f = null;

						if (x < 0 || x >= w || y < 0 || y >= h) {
							f = proceduralFunc(x, y, w, h);
							if (originalMinMax)
							{
								f = (f - originalMinMax[0]) / (originalMinMax[1] - originalMinMax[0]);
							}
						}
						else
						{
							f = field[ y*w + x ];
						}

						p += kernel[k++] * f;
					}
				}

				newField[r*w + c] = p;
				maxP = Math.max(p, maxP);
				minP = Math.min(p, minP);
			}
		}
	}
	newScalar.minmax = [minP, maxP];
	newScalar.normalize();
	return newScalar;
}

ScalarField.prototype.scale = function(newW, newH, cropW, cropH)
{
	// bi-linear interpolation:
	// https://rosettacode.org/wiki/Bilinear_interpolation


	// create a new image
	var stopH = cropH ? cropH : newH;
	var w = this.w, h=this.h, view = this.view;
	var newBuffer = new ArrayBuffer(this.bytesPerPixel * newW * stopH);
	var newView = this.doublePrecision ?
		new Float64Array(newBuffer) : new Float32Array(newBuffer);

    for (var i=0, r=0; r<stopH; r++) {
    	for (var c=0; c<newW; c++, i++) {

    		var gx = (c / newW) * (w-1);
    		var gy = (r / newH) * (h-1);

			var gxi = Math.floor(gx);
			var gyi = Math.floor(gy);

			var c00 = view[  gyi*w    + gxi  ];
			var c10 = view[  gyi*w    + gxi+1];
			var c01 = view[ (gyi+1)*w + gxi  ];
			var c11 = view[ (gyi+1)*w + gxi+1];

			var result = blerp(c00, c10, c01, c11, gx-gxi, gy-gyi);
			newView[i] = result;
		}
	}

	// replace
	this.buffer = newBuffer;
	this.view = newView;
	this.w = newW;
	this.h = stopH;
	this.minmax = undefined;
}

ScalarField.prototype.getMinMax = function()
{
	if (!this.minmax)
	{
		var m0 = Number.MAX_VALUE;
		var m1 = Number.MIN_VALUE;
		var view = this.view;

		for (var r=0, rLen = this.getMaskedH(); r<rLen; r++)
		{
			var R = r * this.w;
			for (var c=0, cLen=this.getMaskedW(); c<cLen; c++) {
				var v = view[R + c];
				if (v != SCALAR_EMPTY) {
					m0 = Math.min(m0, v);
					m1 = Math.max(m1, v);
				}
			}
		}

		this.minmax = [m0, m1]
	}
	return this.minmax;
}

ScalarField.prototype.randomize = function()
{
	var view = this.view;
	for (i=0, len=this.view.length; i<len; i++) {
		view[i] = Math.random();
	}
	this.minmax = null;
}

ScalarField.prototype.getSubregionStats = function(x, y, w, h)
{
	var view = this.view;
	var minmax = [Number.MAX_VALUE, Number.MIN_VALUE];
	var sW = this.w;
	var mean = 0;
	var count = 0;
	var w_1 = this.w-1;
	var h_1 = this.h-1;

	// min/max and mean
	for (var r=y, rr=y+h; r<rr; r++)
	{
		for (var c=x, cc=x+w; c<cc; c++, count++)
		{
			var v = view[ r*sW + c ];
			minmax[0] = Math.min(minmax[0], v);
			minmax[1] = Math.max(minmax[1], v);

			mean += v;
		}
	}
	mean /= count;

	// standard deviation
	var std = 0;
	var steepness = 0;
	var steepnessCount = 0, maxSteepness = 0;

	for (var r=y, rr=y+h; r<rr; r++)
	{
		for (var c=x, cc=x+w; c<cc; c++)
		{
			std += Math.pow(view[ r*sW + c ]-mean, 2);

			if (c > 0 && c < w_1 && r > 0 && r < h_1)
			{
				// kernel components
				var aaa  = view[r    *sW+c-1];
				var ddd  = view[r    *sW+c+1];
				var www  = view[(r-1)*sW+c  ];
				var xxx  = view[(r+1)*sW+c  ];
				var eee  = view[(r-1)*sW+c+1];
				var ccc  = view[(r+1)*sW+c+1];
				var qqq  = view[(r-1)*sW+c-1];
				var zzz  = view[(r+1)*sW+c-1];

				// sobel kernels
				var gx = -qqq - 2*aaa -zzz +eee +2*ddd +ccc;
				var gy =  qqq + 2*www +eee -zzz -2*xxx -ccc;
				var g = Math.abs(gx) + Math.abs(gy);
				steepness += 100 * g;
				steepnessCount++;
				maxSteepness = Math.max(g, maxSteepness);
			}
		}
	}
	std = Math.sqrt( std / count );

	return {
		minmax: minmax,
		mean: mean,
		std: std,
		steepness: steepness / steepnessCount,
		steepnessCount: steepnessCount,
		maxSteepness: maxSteepness,
	};
}

ScalarField.prototype.flipV = function()
{
	var view = this.view;
	var h1=0, h2=this.h-1, w=this.w;
	while (h1 < h2)
	{
		var h1o = h1*w;
		var h2o = h2*w;

		for (var c=0; c<w; c++)
		{
			var temp = view[h1o+c];
			view[h1o+c] = view[h2o+c];
			view[h2o+c] = temp;
		}
		h1++;
		h2--;
	}
}

ScalarField.prototype.flipH = function()
{
	var view = this.view;
	var w=this.w, h=this.h;

	for (var r=0; r<h; r++)
	{
		var c1=0, c2=w-1;
		var rOffset = r*w;

		while (c1 < c2)
		{
			var temp = view[rOffset+c1];
			view[rOffset+c1] = view[rOffset+c2];
			view[rOffset+c2] = temp;

			c1++;
			c2--;
		}
	}
}


ScalarField.prototype.normalize = function(__minmax)
{
	if (this.w > 0 && this.h > 0)
	{
		var minmax = __minmax || this.getMinMax();
		var len = minmax[1] - minmax[0];


		if (len > 0 && !(minmax[0] == 0 && minmax[1] == 1))
		{
			var view = this.view;
			var m0 = minmax[0];
			var m1 = minmax[1];
			var _len = 1.0 / len;

			for (var i=0, len=this.w*this.h; i < len; i++)
			{
				var v = view[i];
				if (v != SCALAR_EMPTY)
				{
					var nV = (v-m0) * _len;
					view[i] = nV > 1 ? 1 : (nV < 0 ? 0 : nV);
				}
			}

			this.originalMinMax = [m0, m1];
			this.minmax = [0, 1];
			this.updated();
		}
	}
}

ScalarField.prototype.invert = function()
{
	this.normalize();
	var view = this.view;

	/*
	for (var i=0; i<view.length; i++) {
		view[i] = 1-view[i];
	}
	*/

	// mirror vertically
	var bytesPerPixel = this.doublePrecision ? 8 : 4;

	// create a buffer
	var buffer = new ArrayBuffer(bytesPerPixel * this.w * 1);
	var tempRow = this.doublePrecision ? new Float64Array(buffer) : new Float32Array(buffer);
	for (var r=0, rows=Math.floor(this.h/2); r<rows; r++)
	{
		var r2 = this.h-1-r;
		for (var c=0; c<this.w; c++)
		{
			tempRow[c] = view[r*this.w+c];
		}

		for (var c=0; c<this.w; c++)
		{
			var c2 = this.w-1-c;

			view[r*this.w+c2] = view[r2*this.w+c];
			view[r2*this.w+c] = tempRow[c2];
		}
	}
	this.updated();
}

ScalarField.prototype.normalizeToPercentile = function(upperPercentile)
{
	var view = this.view;
	var buffer = this.buffer;

	var kthOrder = Math.floor(upperPercentile * view.length);
	kthOrder = Math.max(1, Math.min(view.length, kthOrder));

	var sortedView = this.doublePrecision ?
		new Float64Array(this.buffer.slice(0)) :
		new Float32Array(this.buffer.slice(0));

	/*
	var minValue = Number.MAX_VALUE;
	for (var i=0, len=view.length; i<len; i++)
	{
		var v = view[i];
		if (v !== SCALAR_EMPTY && v < minValue)
		{
			minValue = v;
		}
	}

	var maxValue = findKthOrderStatistic(sortedView, kthOrder);
	*/
	sortedView.sort();
	var minValue = Number.MAX_VALUE;
	for (var i=0, len=sortedView.length; i<len; i++) {
		var v = sortedView[i];
		if (v !== SCALAR_EMPTY)
		{
			minValue = v;
			break;
		}
	}
	var maxValue = sortedView[kthOrder-1];
	this.normalize([minValue, maxValue]);
}

ScalarField.prototype.setGreyscale = function()
{

	var minmax = this.getMinMax();
	var colorset = [
		{
			value: minmax[0],
			rgb: [0, 0, 0]
		},
		{
			value: minmax[1],
			rgb: [255, 255, 255]
		}
	];
	this.colorMap = new ColorMap(colorset)
}

ScalarField.prototype.setColorMap = function(colorMap)
{
	if (colorMap) {
		this.colorMap = colorMap;
	}

	if (this.gpuTexture)
	{
		if (!this.gpuColormapTexture || colorMap)
		{
			if (this.gpuColormapTexture) {
				this.gpuColormapTexture.dispose();
				this.gpuColormapTexture = undefined;
			}
			var theColorMap = colorMap || this.colorMap;
			this.gpuColormapTexture = theColorMap.createGPUColormap();
		}
	}
}

ScalarField.prototype.getColorMap = function() {
	return this.colorMap;
}

ScalarField.prototype.drawFFT = function()
{
	var w = this.w;
	var h = this.h;
	var internalCanvas = document.createElement('canvas');
	internalCanvas.width = w;
	internalCanvas.height = h;

	var context = internalCanvas.getContext('2d');
	var imgData = context.createImageData(this.w, this.h);
	var data = imgData.data;

	// draw magnitude data
	if (!this.fftMagnitude) {
		this.fft();
	}
	var magnitude = this.fftMagnitude;

	// create a new Float32Array for the log, normalized FFT magnitude
	var LOG_RANGE = 1000000;
	var LOG_MAX = Math.log(LOG_RANGE);
	var minmaxrange = this.fftMaxMag-this.fftMinMag;
	var minval = this.fftMinMag;

	for (var r=0, i=0, j=0; r<h; r++)
	{
		for (var c=0; c<w; c++, i++, j+=4)
		{
			var nval = (magnitude[i] - minval) / minmaxrange;
			var lval = (LOG_RANGE-1) * nval + 1;
			var l = Math.log(lval) / LOG_MAX;

			/*
			var c = this.colorMap.mapValue(l);
			data[j] = c.r;
			data[j+1] = c.g;
			data[j+2] = c.b;
			data[j+3] = 255;
			*/

			var nC = Math.floor(l*255);
			data[j] = nC;
			data[j+1] = nC;
			data[j+2] = nC;
			data[j+3] = 255;

		}
	}

	var center = 4*((h/2)*w + w/2);
	data[center]=255;
	data[center+1]=0;
	data[center+2]=0;

	return imgData;
}

/* =========================================================
 * Visualization Code
 * =========================================================
 */

ScalarField.prototype.generatePicture = function()
{
	var internalCanvas = document.createElement('canvas');
	internalCanvas.width = this.w;
	internalCanvas.height = this.h;

	var context = internalCanvas.getContext('2d');
	var imgData = context.createImageData(this.w, this.h);
	var data = imgData.data;

	var colorMap = this.colorMap;
	var view = this.view;

	for (var i=0, j=0, len=this.w * this.h; i<len; i++, j+=4)
	{
		var c = colorMap.mapValue(view[i]);
		if (typeof(c) == 'string') {
			c = d3.color(c);
		}
		data[j] = c.r;
		data[j+1] = c.g;
		data[j+2] = c.b;
		data[j+3] = 255;
	}
	context.putImageData(imgData, 0, 0);
	return internalCanvas;
}

ScalarField.prototype.createGPUTexture = function(colorDif)
{
	// remove old texture
	if (this.gpuTexture)
	{
		this.gpuTexture.dispose();
		this.gpuTexture = undefined;
	}

	if (this.doublePrecision || this.bytesPerPixel!=4)
	{
		console.warn("ScalarField.createGPUTexture: double precision detected, which generally can't be GL texturized.")
	}
	var texture = new THREE.DataTexture(
		this.view,
		this.w, this.h,
		THREE.LuminanceFormat, //THREE.RGBAFormat,
		THREE.FloatType,

		THREE.UVMapping,
		THREE.ClampToEdgeWrapping, 		// wrapS
		THREE.ClampToEdgeWrapping,		// wrapT
		THREE.NearestFilter, 			// mag filter
		THREE.NearestFilter, 			// min filter
		1
	);
	texture.needsUpdate = true;

	this.gpuTexture = texture;
}

ScalarField.prototype.showContour = function(contour)
{
	this.contour = contour;
	if (this.contour < 0) {
		this.contour = -1;
	}
}

ScalarField.prototype.updated = function()
{
	if (this.gpuTexture) {
		this.gpuTexture.dispose();
		this.gpuTexture = undefined;
	}
	this.minmax = undefined;
}

ScalarField.prototype.generatePictureGL = function(canvas, COLOR_DIFF)
{
	// upload the source scalar field data
	if (!this.gpuTexture)
	{
		this.createGPUTexture();
	}

	// upload / update colormap
	if (!this.gpuColormapTexture) {
		this.setColorMap();
	}

	if (!this.colormapShader)
	{
		// load uniforms
		this.colormapUniforms =
		{
			scalarField: { type: "t", value: this.gpuTexture},
			colormap: { type: "t", value: this.gpuColormapTexture},
			contour: { value: this.contour }
		};

		this.colormapShader = new THREE.ShaderMaterial({
			uniforms: this.colormapUniforms,
			fragmentShader: document.getElementById('colormapFragment').textContent,
			vertexShader: document.getElementById('colormapVertex').textContent,
			side: THREE.DoubleSide
		});
	}
	else
	{
		this.colormapUniforms.scalarField.value = this.gpuTexture;
		this.colormapUniforms.colormap.value = this.gpuColormapTexture;
		this.colormapUniforms.contour.value = this.contour;
	}

	if (!this.quadScene)
	{
		var squareMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), this.colormapShader);
		this.quadScene = new THREE.Scene();
		this.quadScene.add(squareMesh);
		this.orthoCamera = new THREE.OrthographicCamera(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);
	}

	if (!this.renderer)
	{
		if (typeof getRenderer == 'undefined' || typeof getRenderer == 'null' )
		{
			this.renderer = new THREE.WebGLRenderer({
				canvas: canvas
			});
			this.renderer.setClearColor(0x000000, 1)
		}
		else
		{
			this.renderer = getRenderer(canvas);
		}
	}
	this.renderer.render(this.quadScene, this.orthoCamera);
}

ScalarField.prototype.generateColorDiffGL = function(canvas)
{
	// upload the source scalar field data
	if (!this.gpuTexture)
	{
		this.createGPUTexture();
	}

	// upload / update colormap
	if (!this.gpuColormapTexture) {
		this.setColorMap();
	}

	// create a colormap to visualize color diff
	if (!this.gpuDiffColormapTexture) {
		var c = getColorPreset('extendedBlackBody');
		this.gpuDiffColormapTexture = c.createGPUColormap();
	}

	if (!this.colorDiffShader)
	{

		this.colorDiffUniforms =
		{
			scalarField: { type: "t", value: this.gpuTexture},
			colormap: { type: "t", value: this.gpuColormapTexture},
			colorDiffScale: { type: 't', value: this.gpuDiffColormapTexture},

			hPitch: { value: 1.0 / this.w },
			vPitch: { value: 1.0 / this.h }

		};

		this.colorDiffShader = new THREE.ShaderMaterial({
			uniforms: this.colorDiffUniforms,
			fragmentShader: document.getElementById('colorDiffFragment').textContent,
			vertexShader: document.getElementById('colormapVertex').textContent,
			side: THREE.DoubleSide
		});
	}

	else
	{
		this.colorDiffUniforms.scalarField.value = this.gpuTexture;
		this.colorDiffUniforms.colormap.value = this.gpuColormapTexture;
	}

	if (!this.quadSceneDiff)
	{
		var squareMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), this.colorDiffShader);
		this.quadSceneDiff = new THREE.Scene();
		this.quadSceneDiff.add(squareMesh);
		this.diffOrthoCamera = new THREE.OrthographicCamera(-1.0, 1.0, 1.0, -1.0, -1.0, 1.0);
	}

	if (!this.renderer)
	{
		if (typeof getRenderer == 'undefined' || typeof getRenderer == 'null' )
		{
			this.renderer = new THREE.WebGLRenderer({
				canvas: canvas
			});
			this.renderer.setClearColor(0x000000, 1)
		}
		else
		{
			this.renderer = getRenderer(canvas);
		}
	}

	this.renderer.render(this.quadSceneDiff, this.diffOrthoCamera);
}


ScalarField.prototype.fft = function()
{
	var w = this.w;
	var h = this.h;

	var mW = w;
	var mH = h;
	var n = h * (mW);

	// get FFT spectrum
	var spectrum = this.spectrum;

	if (!spectrum)
	{
		// calculate FFT
		// measure time
		start = performance.now();
		console.log("calculating FFT...");

		// FFT
		spectrum = rfft2d(this.view, this.w, this.h);
		this.sepctrum = spectrum;

		// measure stop time
	 	stop = performance.now();
	 	console.log("FFT: " + (stop-start).toFixed(2) + " milliseconds");
	 }

 	// calculate FFT magnitude components
 	var maxmag = Number.MIN_VALUE, minmag = Number.MAX_VALUE;
	var magnitude = new Float32Array(n);
	for (var cH = 0, cW = 0, j=0, i=0, len=n*2; i<len; cW++, j++, i += 2)
	{
		if (cW >= w/2+1) {
			cW = 0;
			cH++;
		}

		var mag = Math.sqrt( Math.pow(spectrum[i], 2) + Math.pow(spectrum[i+1], 2) );
		magnitude[cH*mW + cW] = mag;
		maxmag = Math.max(maxmag, mag);
		minmag = Math.min(minmag, mag);
	}

	// mirror and shift the magnitude
	mirror_n_fftshift(magnitude, mW, mH);

	this.fftMagnitude = magnitude;
	this.fftMinMag = minmag;
	this.fftMaxMag = maxmag;
	this.mW = mW;
	this.mH = mH;
}

ScalarField.prototype.calcAmplitudeFrequency = function(_bins)
{
	var BINS = _bins || 30;
	var histogram = [], curve = [];
	for (var b=0; b<BINS; b++) {
		histogram.push(0);
	}

	var view = this.view;
	for (var r=0, rLen=this.getMaskedH(); r<rLen; r++)
	{
		var R = this.w * r;

		for (var c=0, cLen=this.getMaskedW(); c<cLen; c++)
		{
			var v = view[R+c];
			if (v != SCALAR_EMPTY) {
				var b = Math.min(BINS-1, Math.floor(v * BINS));
				histogram[b]++;
			}
		}
	}

	for (var i=0, len=histogram.length; i<len; i++) {
		curve.push({x: i, y: histogram[b]});
	}

	return histogram;

}

ScalarField.prototype.calcSpatialFrequency = function()
{
	if (!this.spectrum) {
		this.fft();
	}

	var magnitude = this.fftMagnitude;
	var mW = this.mW;
	var mH = this.mH;
	var center = [Math.floor(this.w/2), Math.floor(this.h/2)];

	// keep track of min/max frequency
	var frequencies = [];
	var minFreq = Number.MAX_VALUE;
	var maxFreq = Number.MIN_VALUE;


	for (var r=0; r<mH; r++)
	{
		for (var c=0; c<mW; c++)
		{
			//if (c == center[0] && r == center[1])
			if (c == center[0] && r == center[1])
			{
				// DC point, ignore
				continue;
			}
			else
			{
				var f = Math.sqrt( Math.pow(center[0]-c, 2), Math.pow(center[1]-r, 2) );
				var v = magnitude[r*mW +c];

				minFreq = Math.min(f, minFreq);
				maxFreq = Math.max(f, maxFreq);
				frequencies.push({f: f, contrast: v});
			}
		}
	}
	minFreq = 0;

	// create a frequency histogram
	var FREQ_BIN = 30;
	var freqHistogram = []; freqHistogram.length = FREQ_BIN;
	var freqCount = []; freqCount.length = FREQ_BIN;
	for (var i=0; i<FREQ_BIN; i++) {
		freqHistogram[i] = 0;
		freqCount[i] = 0;
	}


	for (var i=0, len=frequencies.length; i<len; i++)
	{
		var freq = frequencies[i];
		var f = freq.f;
		var bin = Math.min( FREQ_BIN-1, Math.floor(((f - minFreq) / (maxFreq-minFreq)) * FREQ_BIN) );

		freqHistogram[bin] += freq.contrast;
		freqCount[bin]++;
	}

	// normalize the bins
	for (var i=0; i<FREQ_BIN; i++) {
		if (freqCount[i] > 1) {
			freqHistogram[i] /= freqCount[i];
		}
	}

	// sort frequencies
	var powerSpectraH = {};
	var powerSpectra = [];
	var spectraIndex = [];

	for (var i=0, len=frequencies.length; i<len; i++)
	{
		var freq = frequencies[i];
		var f = freq.f;
		var c = freq.contrast;

		var a = powerSpectraH[f];
		if (!a) {
			powerSpectraH[f] = [c];
			spectraIndex.push(f);
		}
		else
		{
			a.push(c);
		}
	}

	var maxPower = 0;
	for (var i=0, len=spectraIndex.length; i<len; i++) {
		f = spectraIndex[i];
		var a=powerSpectraH[f];
		var avg=0;
		for (var j=0; j<a.length; j++) {
			avg += a[j];
		}

		avg /= a.length;
		powerSpectra.push({x: f, y: avg, f: f});
		maxPower = Math.max(maxPower, avg)
	}

	powerSpectra.sort(function(a, b) {
		return a.x-b.x;
	});

	return {
		histogram: freqHistogram,
		counts: freqCount,
		minFreq: minFreq,
		maxFreq: maxFreq,
		frequencies: frequencies,
		powerSpectra: powerSpectra,
		maxPower: maxPower
	};
}

ScalarField.prototype.sampleProfile = function(p1, p2, samples)
{
	var values = [];
	var diff = {
		x: p2.x-p1.x,
		y: p2.y-p1.y
	};

	var w = this.w;
	var view = this.view;

	for (var i=0; i<samples; i++)
	{
		var alpha = i/(samples-1);
		var gx = p1.x + alpha * diff.x;
		var gy = p1.y + alpha * diff.y;

		var gxi = Math.floor(gx);
		var gyi = Math.floor(gy);

		var c00 = view[  gyi*w    + gxi  ];
		var c10 = view[  gyi*w    + gxi+1];
		var c01 = view[ (gyi+1)*w + gxi  ];
		var c11 = view[ (gyi+1)*w + gxi+1];

		var r = blerp(c00, c10, c01, c11, gx-gxi, gy-gyi);
		if (isNaN(r)) {
			console.error("NaN in profile sample!");
		}
		values.push(r);
	}
	return values;
}

ScalarField.prototype.blur = function(kernelSize)
{
	kernelSize = 7;
	var hks = Math.floor(kernelSize / 2);
	var kernel = [
		[0.00000067,	0.00002292,	0.00019117,	0.00038771,	0.00019117,	0.00002292,	0.00000067],
		[0.00002292,	0.00078634,	0.00655965,	0.01330373,	0.00655965,	0.00078633,	0.00002292],
		[0.00019117,	0.00655965,	0.05472157,	0.11098164,	0.05472157,	0.00655965,	0.00019117],
		[0.00038771,	0.01330373,	0.11098164,	0.22508352,	0.11098164,	0.01330373,	0.00038771],
		[0.00019117,	0.00655965,	0.05472157,	0.11098164,	0.05472157,	0.00655965,	0.00019117],
		[0.00002292,	0.00078633,	0.00655965,	0.01330373,	0.00655965,	0.00078633,	0.00002292],
		[0.00000067,	0.00002292,	0.00019117,	0.00038771,	0.00019117,	0.00002292,	0.00000067]
	];

	var w = this.w;
	var h = this.h;

	var field = this.view;
	var newBuffer = new ArrayBuffer(this.bytesPerPixel * this.w * this.h);
	var newField = this.doublePrecision ?
		new Float64Array : new Float32Array(newBuffer);

	var maxP = -Number.MAX_VALUE, minP = Number.MAX_VALUE;

	for (var r=hks, R=this.h-hks; r < R; r++)
	{
		for (var c=hks, W=this.w-hks; c < W; c++)
		{
			var p = 0.0;
			for (var rr=0; rr<kernelSize; rr++)
			{
				for (var cc=0; cc<kernelSize; cc++)
				{
					p += kernel[rr][cc] * field[ (r+rr-hks) * w + c+cc-hks ];
				}
			}
			newField[r * w + c] = p;
			maxP = Math.max(p, maxP);
			minP = Math.min(p, minP);
		}
	}

	for (var i=0; i<2; i++ )
	{
		for (var r=(i==0 ? 0 : this.h-hks), j=0; j<hks; j++, r++)
		{
			for (var c = 0; c<this.w; c++)
			{
				var p = field[r * this.w + c];
				maxP = Math.max(p, maxP);
				minP = Math.min(p, minP);
				newField[r*this.w + c] = p;
			}
		}
	}

	for (var i=0; i<2; i++ )
	{
		for (var c=(i==0 ? 0 : this.w-hks), j=0; j<hks; j++, c++)
		{
			for (var r = 0; r<this.h; r++)
			{
				var p = field[r * this.w + c];
				maxP = Math.max(p, maxP);
				minP = Math.min(p, minP);
				newField[r*this.w + c] = p;
			}
		}
	}

	this.buffer = newBuffer;
	this.view = newField;
	this.minmax = [minP, maxP];
	this.normalize();
}

function scalarFromImageData(imgData, cropW, cropH)
{
	var w = imgData.width;
	var h = imgData.height;
	var data = imgData.data;

	var sW = w;
	var sH = h;

	// crop, if desired
	if (cropW) sW = Math.min(sW, cropW);
	if (cropH) sH = Math.min(sH, cropH);

	var scalar = new ScalarField(sW, sH);

	// convert image to scalar
	for (var r=0, j=0; r<h; r++)
	{
		if (r >= sH) {
			continue;
		}

		for (var c=0; c<w; c++)
		{
			if (c >= sW) {
				continue;
			}
			else
			{
				var i = 4*(r*w+c);
				var rr = data[i];
				var gg = data[i+1];
				var bb = data[i+2];

				var l;
				if (rr == gg && gg == bb)
				{
					l = rr;
				}
				else
				{
					l = Math.min(255, Math.floor(.5 + 0.21*rr + 0.72*gg + 0.07*bb));
				}
				scalar.view[j++] = l;
			}
		}
	}
	return scalar;
}

function mirror_n_fftshift(input, m, n)
{
	var m2 = m/2;
	var n2 = n/2;
	for (var r=1, rMirror=n-1; r<n; r++, rMirror--)
	{
		for (var c=0, cMirror=m-1; c<m2; c++, cMirror--)
		{
			input[rMirror*m + cMirror] = input[ r*m + c ];
		}
	}

	for (var r=0; r<n2; r++)
	{
		for (var c=0; c<m; c++)
		{
			var rr = (r + n2) % n;
			var cc = (c + m2) % m;
			var temp = input[ r*m + c ];
			input[ r*m + c ] = input[rr * m + cc];
			input[rr * m + cc] = temp;
		}
	}

	// copy center column
	var rC = n/2
	for (var c=m-1, cc=1; cc<m2; c--, cc++) {
		input[ rC*m+cc ] = input[ rC*m+c ];

	}
	return input;
}
