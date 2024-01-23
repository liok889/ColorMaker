/* -------------------------------------
 * GLSL color analysis pipeline
 * -------------------------------------
 */

function gLoadShader(object, shaderPath, shaderName, callback)
{
	(function(_path, _name, _object, _callback)
	{
		// see if shader code is available inline
		var inline = false;
		if (d3) {
			var idtag = "#shader_" + _name;
			var inlineCode = d3.select(idtag);
			if (inlineCode.size() > 0)
			{
				console.log("loading shader " + _name + " from inline code.")
				_object.shaders[_name] = inlineCode.html();
				if (_callback) {
					setTimeout(_callback, 50, null);
				}
				inline = true;
			}

		}

		if (inline) {
			return;
		} else { //console.log('noinline code for ' + _name);
		}

		d3.text(_path).then(function(text, error)
		{
			if (error) {
				if (_callback) _callback(error); else throw error;
			} else
			{
				_object.shaders[_name] = text;
				if (_callback) _callback(null);

			}
		});
	})(shaderPath, shaderName, object, callback);
}

ColorAnalysis = function(field, glCanvas, _readyCallback, _shaderList)
{
	this.glCanvas = glCanvas;
	this.field = field;
	this.shaders = {};
	this.pipelines = null;
	this.additionalTextures = [];


	// list of canvases to copy results to at the end of analysis (optional)
	this.copyList = [];

	// load shaders
	(function(object, readyCallback, shaderList) {
		var q = d3.queue();
		if (shaderList)
		{
			for (var i=0; i<shaderList.length; i++)
			{
				var shaderPath = shaderList[i].path;
				var shaderName = shaderList[i].name;

				q.defer( gLoadShader, object, shaderPath, shaderName )
			}
		}
		else
		{
			q
				.defer( gLoadShader, object, 'design/src/shaders/vertex.vert', 'vertex' )
				.defer( gLoadShader, object, 'design/src/shaders/cie2000.frag', 'cie2000')
				.defer( gLoadShader, object, 'design/src/shaders/speed.frag', 'speed')
				.defer( gLoadShader, object, 'design/src/shaders/vis.frag', 'vis')
				.defer( gLoadShader, object, 'design/src/shaders/cam022rgb.frag', 'cam02slice')
				.defer( loadExternalColorPresets )
		}

		q.awaitAll(function(error, results)
		{
			if (error) {
				throw error;
			}
			else if (!shaderList)
			{
				object.createDefaultPipelines();
				object.isReady = true;
				if (readyCallback) {
					readyCallback();
				}
			}
			else
			{
				object.isReady = true;
				if (readyCallback) {
					readyCallback();
				}
			}
		});
	})(this, _readyCallback, _shaderList)
}

ColorAnalysis.prototype.addTexture = function(name, field)
{
	this.additionalTextures.push({
		name: name,
		field: field
	});
}
ColorAnalysis.prototype.clearCanvas = function() {
	var gl = this.glCanvas.getContext('webgl');
	gl.clear(gl.COLOR_BUFFER_BIT);
}

ColorAnalysis.prototype.ready = function() {
	return this.isReady === true;
}

ColorAnalysis.prototype.createVisPipeline = function()
{
	var visPipeline = new GLPipeline(this.glCanvas);
	visPipeline.addStage({
		uniforms: {
			scalarField: {},
			colormap: {},
			contour: {value: -1.0}
		},
		inTexture: 'scalarField',
		fragment: this.shaders['vis'],
		vertex: this.shaders['vertex']
	});
	this.visPipeline = visPipeline;
	if (!this.pipelines) this.pipelines = {};
	this.pipelines['vis'] = visPipeline;
}

ColorAnalysis.prototype.createDefaultPipelines = function()
{
	// create a color scale from extendedBlackBody to be used
	// to visualzie cie2000de or speed
	var c = getColorPreset('extendedBlackBody');
	this.gpuDiffColormapTexture = c.createGPUColormap()

	var visPipeline = new GLPipeline(this.glCanvas);
	visPipeline.addStage({
		uniforms: {
			scalarField: {},
			colormap: {},
			contour: {value: -1.0}
		},
		inTexture: 'scalarField',
		fragment: this.shaders['vis'],
		vertex: this.shaders['vertex']
	});
	this.visPipeline = visPipeline;

	var diffPipeline = new GLPipeline(this.glCanvas);
	diffPipeline.addStage({
		uniforms: {
			hPitch: {value: 1.0 / this.field.getMaskedW()},
			vPitch: {value: 1.0 / this.field.getMaskedH()},
			scalarField: {},
			colormap: {},
			colorDiffScale: {value: this.gpuDiffColormapTexture},
			outputColor: {value: true}
		},
		inTexture: 'scalarField',
		fragment: this.shaders['cie2000'],
		vertex: this.shaders['vertex']
	});
	this.diffPipeline = diffPipeline;

	var speedPipeline = new GLPipeline(this.glCanvas);

	// add first stage to perform a cie2000 color-diff
	speedPipeline.addStage({
		uniforms: {
			hPitch: {value: 1.0 / this.field.getMaskedW()},
			vPitch: {value: 1.0 / this.field.getMaskedH()},
			scalarField: {},
			colormap: {},
			colorDiffScale: {value: this.gpuDiffColormapTexture},
			outputColor: {value: false}
		},
		inTexture: 'scalarField',
		fragment: this.shaders['cie2000'],
		vertex: this.shaders['vertex']
	});

	// add a second stage
	speedPipeline.addStage({
		uniforms: {
			colorDiff: {},
			hPitch: {value: 1.0 / this.field.getMaskedW()},
			vPitch: {value: 1.0 / this.field.getMaskedH()},
			colorDiffScale: {value: this.gpuDiffColormapTexture},
			outputColor: {value: false}
		},
		inTexture: 'colorDiff',
		fragment: this.shaders['speed'],
		vertex: this.shaders['vertex']
	});
	this.speedPipeline = speedPipeline;

	var cam02slice = new GLPipeline(this.glCanvas);
	cam02slice.addStage({
		uniforms: { J: {value: 50.0} },
		fragment: this.shaders['cam02slice'],
		vertex: this.shaders['vertex']
	});

	// create a list of pipelines currently loaded
	this.pipelines = {
		vis: visPipeline,
		diff: diffPipeline,
		speed: speedPipeline,
		cam02slice: cam02slice
	};
}

ColorAnalysis.prototype.getUniforms = function(pipelineName, stageIndex, uniformName)
{
	var pipeline = this.pipelines[pipelineName];
	if (!pipeline)
	{
		console.error("Can not find pipeline: " + pipelineName);
		return;
	}
	else
	{
		var stage = pipeline.getStage(stageIndex);
		var uniforms = stage.getUniforms();
		if (uniformName) {
			return uniforms[uniformName];
		}
		else
		{
			return uniforms;
		}
	}
}

ColorAnalysis.prototype.run = function(analysis)
{
	if (!this.pipelines) {
		console.error("Attempting to run ColorAnalysis pipeline before loading");
	}

	// deal with GPU texture
	if (!this.field.gpuTexture) {
		this.field.createGPUTexture();
	}

	// deal with color map
	if (!this.field.gpuColormapTexture) {
		this.field.setColorMap();
	}

	var pipeline = this.pipelines[analysis];
	if (!pipeline) {
		console.error("Can not find pipeline: " + analysis);
		return;
	}

	// initialize stage0 to take scalarField as inTexture
	var stage0 = pipeline.getStage(0);
	var uniforms = stage0.getUniforms();
	if (stage0.inTexture)
	{
		uniforms[stage0.inTexture].value = this.field.gpuTexture;
	}

	for (var i=0; i<pipeline.getStageCount(); i++)
	{
		var s = pipeline.getStage(i);
		if (s.cpuComputation) {
			// skip uniforms since this is a cpu computation stage
			continue;
		}
		else {
			var u = s.getUniforms();

			// does this stage require a colormap?
			if (u.colormap) {
				// if so, give it the current colormap associated with the scalar field
				u.colormap.value = this.field.gpuColormapTexture;
			}

			// other textures?
			for (var t=0; t<this.additionalTextures.length; t++)
			{
				var text = this.additionalTextures[t];
				var textName = text.name;
				if (u[textName])
				{
					if (!text.field.gpuTexture)
					{
						text.field.createGPUTexture();
					}
					u[textName].value = text.field.gpuTexture;
				}
			}
		}
	}

	pipeline.run();

	// deal with copy list
	for (var i=0; i<this.copyList.length; i++)
	{
		var copyTarget = this.copyList[i];
		glCanvasToCanvas(this.glCanvas, copyTarget);
	}
}

ColorAnalysis.prototype.copyToCanvas = function(copyTarget, dontFlip) {
	glCanvasToCanvas(this.glCanvas, copyTarget, dontFlip);
}

ColorAnalysis.prototype.addCopyCanvas = function(canvas)
{
	// render color diff
	this.copyList.push(canvas);
}
