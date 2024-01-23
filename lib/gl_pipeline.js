/* -------------------------------------------
 * Utility implementing a multi-stage image
 * processing pipeine in GLSL
 * -------------------------------------------
 */
var CACHE_RENDERERS = true;

var RENDERERS = {};
function getRenderer(nameOrCanvas)
{
	var name = typeof nameOrCanvas === "string" ? nameOrCanvas : nameOrCanvas.id;
	var canvas = document.getElementById(name) || nameOrCanvas;

	if (RENDERERS[name]) {
		return RENDERERS[name];
	}
	else
	{
		var r = new THREE.WebGLRenderer({
			canvas: canvas
		});
		r.setClearColor(0x444444, 1);

		if (CACHE_RENDERERS) {
			RENDERERS[name] = r;
		}
		return r;
	}
}

function removeRenderCache(name) {
	RENDERERS[name] = undefined;
}

function PipelineStage(stage)
{
	this.inTexture = stage.inTexture;
	this.uniforms = stage.uniforms;

	// load shader
	this.shader = new THREE.ShaderMaterial(
	{
		uniforms: stage.uniforms,
		fragmentShader: stage.fragment,
		vertexShader: stage.vertex,
		side: THREE.DoubleSide
	});

	// create scene
	if (!this.scene)
	{
		var squareMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), this.shader);
		this.scene = new THREE.Scene();
		this.scene.add(squareMesh);
		this.camera = new THREE.OrthographicCamera(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);
	}
}

PipelineStage.prototype.getUniforms = function()
{
	return this.shader.uniforms;
}

function GLPipeline(_destCanvas)
{
	// destingation canvas
	this.destCanvas = _destCanvas;

	// get OpenGL context
	this.renderer = getRenderer(this.destCanvas);

	this.buffers = [];
	this.frontBuffer = -1;

	// pipeline stages
	this.stages = [];
}

GLPipeline.prototype.addStage = function(stage)
{
	if (this.stages.length == 0)
	{
		// no need for extra buffer at this point
	}
	else
	{
		// create two offscreen buffers
		var canvas = this.destCanvas;
		var w = +canvas.width;
		var h = +canvas.height;

		for (var i=0; i<2; i++)
		{
			var tex = new THREE.WebGLRenderTarget(w, h, {
				minFilter: THREE.NearestFilter,
				magFilter: THREE.NearestFilter,

				// floating point texture
				format: THREE.RGBAFormat,
				type: THREE.FloatType,

				// clamp to edge
				wrapS: THREE.ClampToEdgeWrapping,
				wrapT: THREE.ClampToEdgeWrapping,
				depthBuffer: false
			});
			this.buffers.push(tex);
		}
		this.frontBuffer = 0;
	}

	if (stage.cpuComputation) {
		this.stages.push(stage);
	}
	else {
		this.stages.push(new PipelineStage(stage));
	}
}

GLPipeline.prototype.getFront = function() {
	return this.buffers[this.frontBuffer];
}
GLPipeline.prototype.getBack = function() {
	return this.buffers[this.frontBuffer == 0 ? 1 : 0];
}
GLPipeline.prototype.flipBuffers = function() {
	if (this.frontBuffer == 0) {
		this.frontBuffer = 1;
	}
	else {
		this.frontBuffer = 0;
	}
}

GLPipeline.prototype.run = function()
{
	this.cpuReturnValues = [];
	for (var i=0, len=this.stages.length; i < len; i++)
	{
		var stage = this.stages[i];

		// check to see if this is a cpu cpuComputation
		if (stage.cpuComputation)
		{
			var buffer = glCanvasToBuffer(this.destCanvas);
			var retValue = stage.cpuComputation(buffer);
			this.cpuReturnValues.push(retValue);
		}
		else {
			// GLSL stage
			// scan uniforms and see if any of them need results from CPU compute
			for (var uniformID in stage.shader.uniforms) {
				var uniform = stage.shader.uniforms[uniformID];
				if (uniform.cpuComputation) {
					var retValue = this.cpuReturnValues[uniform.index];
					var value = retValue[uniform.id];
					uniform.value = value;
				}
				else if (uniformID == 'randomSeed') {
					if (uniform.value < 0) {
						// Could also change everytime, although not necesserily
						// since the strcuture of the field is changing anyway
						uniform.value = Math.random();
					}
				}
			}

			// set shader to take texture from the previous stage
			if (i>0)
			{
				var u = stage.shader.uniforms;

				var inTex = stage.inTexture;
				if (inTex === undefined || inTex === null) {
					throw ("No inTexture defiend for stage " + i);
				}
				else {
					u[inTex].value = this.getFront().texture;
				}
			}

			if (i==len-1 || stage.renderToCanvas)
			{
				// render to canvas
				this.renderer.render(stage.scene, stage.camera);
			}
			else
			{
				// render to back buffer
				this.renderer.render(stage.scene, stage.camera, this.getBack());

				// flip buffers
				this.flipBuffers();
			}
		}
	}
}

GLPipeline.prototype.getStageCount = function() {
	return this.stages.length;
}

GLPipeline.prototype.getStage = function(index) {
	return this.stages[index];
}

// copy the results of GL render from source to copyTarget canvas
// (which can be non-GL)
function glCanvasToCanvas(source, copyTarget, dontFlip)
{
	// read the color diff
	var gl = source.getContext('webgl');
	var w = gl.drawingBufferWidth;
	var h = gl.drawingBufferHeight;

	var pixels = new Uint8Array(w * h * 4);
	gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

	// flip pixels

	var flipPixels;
	if (dontFlip) {
		flipPixels = pixels;
	}
	else
	{
		flipPixels = new Uint8Array(w * h * 4);
		var I=0;
		for (var r=h-1; r>=0; r--)
		{
			var rI = r * w * 4;
			for (var c=0; c<w; c++, I+=4, rI += 4)
			{
				flipPixels[I] = pixels[rI];
				flipPixels[I+1] = pixels[rI+1];
				flipPixels[I+2] = pixels[rI+2];
				flipPixels[I+3] = pixels[rI+3];
			}
		}
	}

	// copy them to the taget canvas
	var ctx = copyTarget.getContext('2d');
	var imgData = ctx.getImageData(0, 0, w, h);
	imgData.data.set(flipPixels);
	ctx.putImageData(imgData, 0, 0);
}

function glCanvasToBuffer(source)
{
	// read the color diff
	var gl = source.getContext('webgl');
	var w = gl.drawingBufferWidth;
	var h = gl.drawingBufferHeight;

	var pixels = new Float32Array(w * h * 4);
	gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels);
	return pixels;
}
