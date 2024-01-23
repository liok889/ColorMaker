// collection of plots
function putNodeOnTop(node)
{
    var n = jQuery(node);
    n.parent().append(n.detach());
}

function CurvePlotCollection(svg, colorSpacePicker)
{
    var CURVE_PLOT_W = 100*1.5;
    var CURVE_PLOT_H = 100*1.5;
    var CURVE_PLOT_PAD = 18*1.5;

    this.svg = svg;
    this.plots = [];

    this.parentGroup = this.svg.append('g');

    // which combinations of curves are we looking at?
    this.coordsCombo = {
        RGB: [[0, 1], [0, 2], [1, 2]],
        LAB: [[1, 2], [1, 0], [2, 0]], // AB, AL, BL
        JAB: [[1, 2], [1, 0], [2, 0]],
        HSL: [[1, 2], /*[0, 2],*/ [0, 1]],   // HS, HL, SL
        HCL: [[1, 2], /*[0, 2],*/ [0, 1]]   // HC, HL, SL
    };

    var colorSpace = colorSpacePicker.getColorSpace();
    for (var i=0; i<this.coordsCombo[colorSpace].length; i++) {
        var coords = this.coordsCombo[colorSpace][i];
        var g = this.parentGroup.append('g')
            .attr('transform', 'translate(' + (i*(CURVE_PLOT_W+CURVE_PLOT_PAD)+CURVE_PLOT_PAD) + ',0)');

        var plot = new CurvePlot(
            g, CURVE_PLOT_W, CURVE_PLOT_H, coords, colorSpacePicker
        );
        plot.parent = this;
        this.plots.push(plot);

    }

    if (this.coordsCombo[colorSpace].length < 3) {
        var xOffset = (3-this.coordsCombo[colorSpace].length)*
            (CURVE_PLOT_W+CURVE_PLOT_PAD)/2;
        this.parentGroup.attr('transform', 'translate(' + xOffset +',0)');
    }
}

CurvePlotCollection.prototype.updateSolution = function(solution, skipPlot)
{
    this.solution = (solution);

    for (var i=0; i<this.plots.length; i++) {
        if (skipPlot != this.plots[i]) {
            this.plots[i].updateSolution(this.solution);
        }
    }
    if (this.editCallback) {
        this.editCallback(solution);
    }
}

CurvePlotCollection.prototype.updateColorSpace = function(picker)
{
    for (var i=0; i<this.plots.length; i++) {
        this.plots[i].updateColorSpace(picker);
    }
}

CurvePlotCollection.prototype.setEditCallback = function(callback)
{
    this.editCallback = callback;
}

CurvePlotCollection.prototype.setUpdateCallback = function(callback)
{
    this.updateCallback = callback;
}

CurvePlotCollection.prototype.dispose = function()
{
    this.svg.selectAll('*').remove();
}

// one colormap curve plot
const BEAD_RADIUS = 3*1.5;
function CurvePlot(svg, w, h, coords, colorSpacePicker)
{
    // size of axis label (in height pixels)
    var LABEL_H = 15;
    this.svg = svg;
    this.h = h;
    this.w = w;
    this.colorSpace = colorSpacePicker;
    this.coords = coords;

    var range = this.colorSpace.getRange();
    var coords = this.coords.slice();
    this.key1 = range[coords[0]].key;
    this.key2 = range[coords[1]].key;

    this.autoControl1 = range[coords[0]].autoControl == true;
    this.autoControl2 = range[coords[1]].autoControl == true;

    // figure out what's the missing key
    this.missingKey = null;
    for (var i=0; i<3; i++) {
        if (range[i].key != this.key1 && range[i].key != this.key2) {
            this.missingKey = range[i].key;
        }
    }

    // create an image to render a slice of the colormap
    this.image = this.svg.append('g').append('image')
        .attr('width', this.w)
        .attr('height', this.h);


    var borderOffset = 0;//LABEL_H+3;
    this.borderRect = this.svg.append('rect')
        .attr('width', w+borderOffset).attr('height', h+borderOffset)
        .style('stroke', 'black')
        .style('stroke-width', '0.5px')
        .style('fill', 'none')
        .attr('x', -borderOffset)
    this.bgRect = this.svg.append('rect')
        .attr('width', w).attr('height', h)
        .style('stroke', 'none')
        .style('stroke-width', '0.5px')
        .style('fill', 'none');


    var colorSpaceRange = this.colorSpace.getRange();
    this.labelX = this.svg.append('text')
        .attr('class', 'colorAxisLabel')
        .html(colorSpaceRange[this.coords[0]].name)
        .attr('text-anchor', 'middle')
        .attr('x', (this.w - borderOffset)/2)
        .attr('y', this.h+LABEL_H)
        //.style('font-size', LABEL_H);
    this.labelY = this.svg.append('text')
        .html(colorSpaceRange[this.coords[1]].name)
        .attr('class', 'colorAxisLabel')
        //.attr('y', this.h/2)
        //.style('font-size', LABEL_H);

    var xOffset = -4;//this.labelY.node().getComputedTextLength()-2;
    var yOffset = borderOffset/2 + this.h/2 + this.labelY.node().getComputedTextLength()/2
    this.labelY
        .attr('transform', 'translate(' + xOffset +',' + yOffset + ') rotate(-90)');

    //this.labelY.attr('x', -this.labelY.node().getComputedTextLength()-2);

    this.groupCurve = this.svg.append('g');
}

CurvePlot.prototype.updateColorSpace = function(colorSpacePicker)
{
    this.colorSpace = colorSpacePicker;
    if (this.solution) {
        this.updateSolution(this.solution);
    }

    this.labelX.html(colorSpaceRange[this.coords[0]].name);
    this.labelY = this.svg.append('text')
        .html(colorSpaceRange[this.coords[1]].name);
    this.labelY.attr('x', this.labelY.node().getComputedTextLength()-2);

}

CurvePlot.prototype.getColorFromSlice = function(beadIndex, x, y)
{
    var key1 = this.key1;
    var key2 = this.key2;

    // figure out what's the missing key
    var missingKey = this.missingKey;
    var color = {};
    var beadColor = this.colorSpace.getColorFromSolution(this.solution[beadIndex]);
    if (x === undefined && y === undefined) {
        return beadColor;
    }
    else {
        var scaled = this.revScale(x, y);
        if (!scaled) {
            return null;
        }
        else {
            color[key1] = scaled[0];
            color[key2] = scaled[1];
            color[missingKey] = beadColor[missingKey];
            return this.colorSpace.createColor(color);
        }
    }
}

CurvePlot.prototype.renderSlice = function(beadIndex, x, y)
{
    var SLICE_STEP=1;
    var SLICE_GAP=1;

    var color = this.getColorFromSlice(beadIndex, x, y)

    var canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    var context = canvas.getContext("2d")

    for (var r=0; r<this.h; r+= SLICE_GAP)
    {
        //var _y = this.colorSpace.scaleRange(r/(this.h-1), coords[1]);
        var _r = r/(this.h-1);
        for (var c=0; c<this.w; c+= SLICE_GAP)
        {
            var _c = c/(this.w-1);
            scaled = this.revScale(_c, _r);
            if (!scaled) {
                // non-displayable
                context.fillStyle = "rgb(255, 255, 255, 0)";
            }
            else {
                //var _x = this.colorSpace.scaleRange(c/(this.w-1), coords[0]);

                color[this.key1] = scaled[0];
                color[this.key2] = scaled[1];

                var nonRGB = this.colorSpace.createColor(color);
                if (nonRGB.displayable()) {
                    var rgb = d3.rgb(nonRGB);
                    context.fillStyle = rgb.toString();
                }
                else {
                    context.fillStyle = "rgb(255, 255, 255, 0)";
                }
            }
            context.fillRect(c, r, SLICE_STEP, SLICE_STEP);

        }
    }
    this.image.attr('xlink:href', canvas.toDataURL());
    this.image.style('opacity', 1.0);
}

CurvePlot.prototype.moveBead = function(bead, beadIndex)
{
    const MIN_BEAD_DIST_MOVE = 4;
    (function(obj) {
        var moveCallback = function(x, y)
        {
            obj.beadMoved = true;
            var originalColor = obj.solution[beadIndex].slice();
            var originalX = +bead.attr('cx')/obj.w;
            var originalY = +bead.attr('cy')/obj.h;

            var newColor = obj.getColorFromSlice(
                beadIndex,
                obj.autoControl1 ? originalX : x,
                obj.autoControl2 ? originalY : y
            );
            if (newColor && newColor.displayable()) {
                bead
                    .attr('fill', newColor.toString())

                if (!obj.autoControl1) {
                    bead.attr('cx', x * obj.w);
                }
                if (!obj.autoControl2) {
                    bead.attr('cy', y * obj.h);
                }
                obj.editSolution(beadIndex, newColor);
            }
        }
        var downCallback = function(x, y)
        {
            // make all other beads transparent except this one
            putNodeOnTop(bead.node());
            obj.beadMoved = false;
            obj.beadDragging = true;
            obj.beads.style('opacity', 0.05);
            obj.path.style('opacity', 0.3);
            bead.style('opacity', 1.0);
            bead.attr('r', BEAD_RADIUS*1.5);

            // render slice
            obj.renderSlice(beadIndex, x, y)
        }

        function clearSlice()
        {
            var canvas = document.createElement('canvas');
            canvas.width = obj.w;
            canvas.height = obj.h;
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, obj.w, obj.h);
            obj.image.attr('xlink:href', canvas.toDataURL());
        }
        var upCallback = function()
        {

            // restore bead transparency and original radius
            obj.beads.style('opacity', null);
            obj.path.style('opacity', null);
            bead.attr('r', BEAD_RADIUS);

            // clear color slice
            clearSlice();

            // notify update callback
            if (obj.beadMoved && obj.parent.updateCallback)
            {
                obj.parent.updateCallback(obj.solution, beadIndex);
            }
            obj.beadMoved = false;
            obj.beadDragging = false;

        }

        var inCallback = function(x, y)
        {
            putNodeOnTop(bead.node());
            bead.style('stroke-width', '1.5px');
            if (obj.clearTimeout!==undefined) {
                clearTimeout(obj.clearTimeout);
                obj.clearTimeout = undefined;
            }
            if (!obj.beadDragging) {
                obj.renderSlice(beadIndex, x, y);
            }
        }

        var outCallback = function(x, y) {
            bead.style('stroke-width', '1px');
            if (!obj.beadDragging) {
                obj.clearTimeout = setTimeout(function() {clearSlice();}, 20)
            }
        }

        addMMCallback(bead, obj.bgRect.node(),
            moveCallback,
            downCallback,
            upCallback,
            inCallback, outCallback,
            MIN_BEAD_DIST_MOVE)
    })(this);
};

CurvePlot.prototype.editSolution = function(index, newColor)
{
    var MAKE_EDIT_EVERY = 30;   // mili seconds
    function makeEdit(obj, _newColor) {
        var labColor = d3.lab(_newColor);
        obj.solution[index] = [labColor.l, labColor.a, labColor.b];
        if (obj.path) {
            obj.path.attr('d', obj.lineGen(obj.solution));
        }
        if (obj.parent) {
            obj.parent.updateSolution(obj.solution, obj);
        }
        obj.lastEditTime = Date.now();
    }

    function scheduleEdit(obj, _newColor, timeToRun)
    {
        if (obj.scheduledEdit !== undefined) {
            clearTimeout(obj.scheduledEdit);
        }
        obj.scheduledEdit = setTimeout(function() {
            makeEdit(obj, _newColor);
            obj.scheduledEdit = undefined;
        }, timeToRun);
    }

    if (this.lastEditTime !== undefined) {
        var elapsed = Date.now() - this.lastEditTime;
        if (elapsed < MAKE_EDIT_EVERY) {
            scheduleEdit(this, newColor, MAKE_EDIT_EVERY-elapsed)
            return;
        }
    }
    makeEdit(this, newColor);

    /*

    var labColor = d3.lab(newColor);
    this.solution[index] = [labColor.l, labColor.a, labColor.b];
    if (this.path) {
        this.path.attr('d', this.lineGen(this.solution));
    }
    if (this.parent) {
        this.parent.updateSolution(this.solution, this);
    }
    */

}

CurvePlot.prototype.updateSolution = function(solution)
{
    // how big are the circle beads

    // store solution
    if (solution) {
        this.solution = solution;
    };
    if (!this.path) {
        this.path = this.svg.append('path')
            .attr('class', 'colorCurvePath');
    }

    this.beads = this.svg.selectAll("circle.colorCurveBeads")
        .data(solution);
    this.beads = this.beads.enter().append('circle')
        .attr('class', 'colorCurveBeads')
        .attr('r', BEAD_RADIUS)
        .merge(this.beads);

    this.beads.exit().remove();


    (function(obj, _solution)
    {
        var scale = function(solutionColor, coordIndex) {
            var coord = obj.coords[coordIndex];
            var tKey = obj.colorSpace.getRange()[coord].key;
            var color = obj.colorSpace.getColorFromSolution(solutionColor);
            var revRange = obj.colorSpace.revScaleRange(color[tKey], coord)
            if (isNaN(revRange)) {
                console.log('error NaN in revRange');
            }
            return revRange;
        }
        var revScale = function(x, y) {
            var _x = obj.colorSpace.scaleRange(x, obj.coords[0]);
            var _y = obj.colorSpace.scaleRange(y, obj.coords[1]);
            return [_x, _y];
        }
        var xScale = function(solutionColor) {
            return obj.w * scale(solutionColor, 0);
        }
        var yScale = function(solutionColor) {
            return obj.h * scale(solutionColor, 1);
        }

        var radialHS = function(d)
        {
            var c = obj.colorSpace.getColorFromSolution(d);
            var hue = isNaN(c.h) ? 0 : c.h;
            if (hue > 180) {
                hue -=360;
            }
            var theta = hue * (Math.PI / 180);
            var sat_chroma = c.s ? c.s : c.c;

            var r = (Math.min(obj.w, obj.h)/2) *
                obj.colorSpace.revScaleRange(sat_chroma, 1);    // saturation
            var radcoord = [
                r * Math.cos(theta) + obj.w/2, (r*Math.sin(theta) + obj.h/2)
            ];
            return radcoord;
        }
        var revRadialHS = function(x, y) {
            var _x = (x-.5);
            var _y = (y-.5);
            var r =
                Math.sqrt( Math.pow(_x, 2) + Math.pow(_y, 2) );
            //r /= Math.min(obj.w, obj.h)/2;
            if (r > .5) {
                return null;
            }
            else {
                var theta = Math.atan2(_y / r, _x / r);
                var hue = theta * (180 / Math.PI);
                var saturation = obj.colorSpace.scaleRange(2*r, 1);
                return [hue, saturation];
            }
        }

        if (
            obj.coords[0] == 0 && obj.coords[1] == 1 &&
            (obj.colorSpace.getColorSpace() == "HSL" || obj.colorSpace.getColorSpace() == "HCL")
        )
        {

            xScale = function(d) {
                var radcoord = radialHS(d);
                return radcoord[0];
            }

            yScale = function(d) {
                var radcoord = radialHS(d);
                return radcoord[1];
            }
            revScale = revRadialHS;

        }

        var lineGen = d3.line()
            .x(function(d) { return xScale(d); })
            .y(function(d) { return yScale(d); })

        obj.xScale = xScale;
        obj.yScale = yScale;
        obj.revScale = revScale;
        obj.lineGen = lineGen;

        // update path
        obj.path.attr('d', lineGen(_solution));

        // update beads
        obj.beads
            .attr('cx', function(d) {
                var cx = xScale(d);
                return cx;
            })
            .attr('cy', function(d) { return yScale(d); })
            .attr('fill', function(solutionColor)
            {
                var c = obj.colorSpace.getColorFromSolution(solutionColor);
                var rgb = d3.rgb(c);
                return rgb.toString();
            })
            .on('mouseover', function() {
                putNodeOnTop(this);
                d3.select(this).style('stroke-width', '1.5px');
            })
            .on('mouseout', function() {
                d3.select(this).style('stroke-width', null);

            })
        obj.beads.each(function(d, i) {
            obj.moveBead(d3.select(this), i);
        })

    })(this, solution);
}
