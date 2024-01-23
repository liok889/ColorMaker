var shaderList = [
    {name: 'vis',		path: 'lib/shaders/vis.frag'},
    {name: 'vertex',	path: 'lib/shaders/vertex.vert'},
];
ALL_SCALAR_VIS = [];

function ScalarVis(field, canvas, colormap)
{

    this.field = field;
    this.w = field.w;
    this.h = field.h;
    this.canvas = canvas;
    this.colormap = colormap;

    if (this.canvas)
    {
        (function(me) {
            me.visualizer = new ColorAnalysis(
                me.field, me.canvas,
                function() {
                    me.initVisPipeline();
                }, shaderList
            );
        })(this);
    }

    if (!this.colormap) {
        this.colormap = getColorPreset('greyscale');
    }
    this.field.setColorMap(this.colormap);

    ALL_SCALAR_VIS.push(this);
}

ScalarVis.prototype.dispose = function()
{
    for (var i=0; i<ALL_SCALAR_VIS.length; i++)
    {
        if (ALL_SCALAR_VIS[i] == this)
        {
            ALL_SCALAR_VIS.splice(i, 1);
            break;
        }
    }
    this.field = undefined;
    this.canvas = undefined;
    this.colormap = undefined;
}

ScalarVis.prototype.setContour = function(contour)
{
    var visUniforms = this.visualizer.getUniforms('vis', 0);
    visUniforms.contour.value = contour;
    this.vis();
}

ScalarVis.setUniversalColormap = function(colormap) {
    for (var i=0; i<ALL_SCALAR_VIS.length; i++)
    {
        ALL_SCALAR_VIS[i].field.setColorMap(colormap);
        ALL_SCALAR_VIS[i].colormap = colormap;

        // render?
        ALL_SCALAR_VIS[i].vis();
    }
}

ScalarVis.prototype.vis = function()
{
    if (!this.canvas)
    {
        console.log("Error: ScalarVis doesn't have a canvas.");
    }
    else if (!this.visualizer || !this.visualizer.ready())
    {
        // pipeline not yet ready. Set flag to callVis when it's ready
        this.callVisFlag = true;
    }
    else {
        this.visualizer.run('vis');
    }

}

ScalarVis.prototype.initVisPipeline = function()
{
    if (!this.canvas) {
        console.log("Error: ScalarVis doesn't have a canvas.");
        return;
    }

    // standard vis
    var vis = new GLPipeline(this.visualizer.glCanvas);
    vis.addStage({
        uniforms: {
            scalarField: {},
            colormap: {},
            contour: {value: -1.0},
        },
        inTexture: 'scalarField',
        fragment: this.visualizer.shaders['vis'],
        vertex: this.visualizer.shaders['vertex']
    });

    this.visualizer.pipelines = {
        vis: vis,
    };

    //this.visualizer.createVisPipeline();
    if (this.callVisFlag) {
        this.callVisFlag = false;
        this.vis();
    }
}
