var DEFAULT_BLOCK_SIZE = .1;
var MIN_BLOCK_SIZE = .1/2;


function ColormapScaffold(svg, w, h)
{
    // parent svg (or group) and dimensions
    this.svg = svg;
    this.gradients = this.svg.append('g');
    this.userPrefColors = this.svg.append('g');
    this.highlights = this.svg.append('g');

    // create key indexed preference list
    // to be used to local edits
    this.keyIndexedPrefs = {};

    this.w = w;
    this.h = h;

    // user preferences (i.e., colors dropped in by the user)
    this.userPrefs = [];

    this.createUI();
}

ColormapScaffold.prototype.getUIWidth = function()
{
    return this.w;
}

ColormapScaffold.prototype.getImagePlaceholder = function()
{
    return this.imageGroup;
}
ColormapScaffold.prototype.getRampEditorPlaceholder = function()
{
    return this.rampEditorGroup;
}

ColormapScaffold.prototype.addCallback = function(lumProfile)
{

    let userSel = scaffold.copyUserPrefs();
    userSel.sort((a, b) => a.mu - b.mu);

    let distMatrix = [];
    for (let i=0, len=userSel.length-1; i<len; i++) {
        var col1 = userSel[i].color;
        var col2 = userSel[i+1].color;

        var distance = cie2000Diff(
            {l: col1.l, a: col1.a, b: col1.b},
            {l: col2.l, a: col2.a, b: col2.b}
        );
        var userDist = Math.abs(userSel[i].mu - userSel[i+1].mu);

        if(lumProfile == 'diverging' && userSel[i].end < 0.5 && userSel[i+1].start > 0.5) { }
        else if(lumProfile == 'wave' && ((userSel[i].end < 0.33 && userSel[i+1].start > 0.33) || (userSel[i].end < 0.66 && userSel[i+1].start > 0.66)) ) { }
        else {
            distMatrix.push({ col1: col1, col2: col2, cie00: distance, userDist: userDist });
        }

    }

    d3.selectAll('text#alertSign').remove();
    /*
    for (let j=0, len=distMatrix.length; j<len; j++) {
        if((distMatrix[j].cie00 > 50) && (distMatrix[j].userDist < 0.3)) {
            d3.select('#svgMain')
                .append('text')
                .attr('id', 'alertSign')
                .attr("class", "fa")
                .attr('x',20)
                .attr('y',147.5)
                .style('stroke', '#000')
                .style('stroke-width', '0.8px')
                .attr('font-size', '20px')
                .attr('fill', '#f7dd09')
                .text("\uf071")
                .on('mouseover', function() {
                    d3.select('span.labelAlert').style("display", "inline-block");
                    let txtVal = d3.select('span.labelAlert').node().getBoundingClientRect();
                    drawAlertBox(txtVal);
                    drawAlertColors(txtVal, distMatrix);
                })
                .on('mouseout', function() {
                    d3.select('span.labelAlert').style("display", "none");
                    d3.selectAll('rect#alertBox').remove();
                    d3.selectAll('rect#alertColors').remove();
                });
        }
        else { console.log('no alerts'); }
    }
    */

    function drawAlertBox(txt) {
        d3.select('#colormapUI')
            .append('rect')
            .attr('id', 'alertBox')
            .attr('x', 40)
            .attr('y', 10)
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('width', txt.width + 20)
            .attr('height', txt.height + 35)
            .style('stroke', '#000')
            .style('stroke-width', '0.8px')
            .attr('fill', '#fff')
            .attr('fill-opacity', 0.7);
    }

    function drawAlertColors(txt, color) {
        let drawMat = [];
        for (let j=0, len=color.length; j<len; j++) {
            if((color[j].cie00 > 50) && (color[j].userDist < 0.3)) {
                drawMat.push({ col1: color[j].col1, col2: color[j].col2 });
            }
        }
        for(let j=1; j<=drawMat.length; j++) {
            let c1 = d3.rgb(drawMat[j-1].col1);
            let c2 = d3.rgb(drawMat[j-1].col2);
            for(let i=1; i<=2; i++) {
                d3.select('#colormapUI')
                    .append('rect')
                    .attr('id', 'alertColors')
                    .attr('x', 55*j + 25*(i-1))
                    .attr('y', txt.height + 20)
                    .attr('width', 20)
                    .attr('height', 20)
                    .style('stroke', '#000')
                    .style('stroke-width', '1px')
                    .attr('fill', function() {
                        if (i === 1) { return c1; }
                        else if (i === 2) { return c2; }
                    })
            }
        }
    }
}

ColormapScaffold.prototype.clear = function () {
    console.log("clearing");
    this.userPrefs = [];
    this.storedPrefs = null;
    this.updateUserPrefs();
    this.updateAllGradients();

};

ColormapScaffold.prototype.createUI = function()
{
    this.rect = this.svg.append('rect')
        .attr('id', 'colormapDrop')
        .attr('x', 0)
        .attr('y', -3*1.5)
        .style('fill', 'none')
        .style('stroke', 'black')
        .style('stroke-width', '1px')
        .attr('width', this.w)
        .attr('height', this.h + 6*1.5)
        .attr('stroke-dasharray', "4 1");

    this.prompt = this.svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', this.w/2)
        .attr('y', this.h+ 6*1.5-20)
        .html("add preferred colors here (if desired)")
        .style('fill', '#bababa')
        .style('stroke', 'none')
        .style('font-size', this.h*.6);


    this.svg.append('image')
        .attr('y', this.h/2-20/2-20+5)
        .attr('x', this.w + 4)
        .attr('width', 20)
        .attr('xlink:href', 'profile/replay.png')
        .style('opacity', 0.2)
        .on('mouseover', function() {
            d3.select(this).style('opacity', 1.0)
        })
        .on('mouseout', function() {
            d3.select(this).style('opacity', 0.2)
        })
        .on('click', function() {
            var fullRun = true;
            var instance = true;
            opt.scheduleReRun(fullRun, instance);
        })

    this.svg.append('image')
        .attr('y', this.h-20)
        .attr('x', this.w + 4)
        .attr('width', 20)
        .attr('xlink:href', 'profile/trash.png')
        .style('opacity', 0.2)
        .on('mouseover', function() {
            d3.select(this).style('opacity', 0.8)
        })
        .on('mouseout', function() {
            d3.select(this).style('opacity', 0.2)
        })
        .on('click', function() {
            scaffold.clear();
            scaffold.triggerCallbacks();
        })


    this.imageGroup = this.svg.append('g')
        .attr('transform', 'translate(' + 0 + ',' + (this.h+10*1.5) + ')');

    this.image = this.imageGroup.append('image')
        .attr('id', 'colormapImage')
        .attr('x', 0)
        .attr('y', this.h)
        .attr('width', this.w)
        .attr('height', this.h)
        .style('stroke', 'black');

    // add up/ down buttons
    this.downArrow = this.imageGroup.append('text')
        .attr('id', 'downArrow')
        .attr("class", "fa")
        .attr('x', COLORMAP_W+3)
        .attr('y', this.h+(COLORMAP_H/2)+20)
        .style('font-size', 28)
        .attr('fill', '#222021')
        .html(null);
    this.upArrow = this.imageGroup.append('text')
        .attr('id', 'upArrow')
        .attr("class", "fa")
        .attr('x', COLORMAP_W+3)
        .attr('y', this.h+(COLORMAP_H/2))
        .style('font-size', 28)
        .attr('fill', '#222021')
        .html(null);

    this.statusText = this.imageGroup.append('text')
        .attr('id', 'statusText')
        .attr('x', this.w)
        .attr('y', this.h-3)
        .attr('text-anchor', 'end')
        .attr('class',  'smallText');

    this.rampEditorGroup = this.imageGroup.append('g')
        .attr('transform', 'translate(' + 0 + ',' + (this.h + 2*1.5) + ')');

    // add colormap mouseover event to create ramp editor
    (function(obj)
    {
        d3.select("#colormapImage").on('mousemove', function()
        {
            if (COLOR_DRAGGING || COLOR_MOVING) {
                return;
            }
            var svg = scaffold.getRampEditorPlaceholder();
            var globalMouse = d3.mouse(svg.node());
            var relMouse = d3.mouse(this);
            var normPos = relMouse[0] / +d3.select(this).attr('width');

            var colormap = opt.getColorMap();
            var editor = RAMP_EDITOR;
            if (colormap && !opt.isRunning())
            {
                if (!RAMP_EDITOR ) {
                    editor = new RampEditor(svg, scaffold.getUIWidth());
                    RAMP_EDITOR = editor;

                }

                var color = opt.getColorMap().mapValue(normPos);
                var solution = opt.getSolution();
                var keyIndex = Math.min(solution.length-1, Math.floor(.5 + normPos * (solution.length-1)));

                editor.render(color, keyIndex, keyIndex / (solution.length-1));
                editor.centerAt(globalMouse[0], -37*1.5);
            }
        }).on('mouseout', function()
        {
            if (RAMP_EDITOR) {
                RAMP_EDITOR.selfRemove();
            }
        });
    })(this);

    // add color dragging event callbacks
    SelectorEvent(this);
}

var COLOR_DRAGGING = false;
var COLOR_MOVING = false;
function SelectorEvent(_obj)
{
    function dragSelected()
    {
        var curMouse = d3.mouse(d3.select("#svgMain").node());
        var svg = d3.select("#svgMain");
        if (!LAST_MOUSE)
        {
            COLOR_DRAGGING = true;
            var selector = d3.select("#selectedColor");

            // create a dragged version of the color square
            var dragSelector = svg.append('rect')
                .attr('id', 'dragSelector')
                .attr('x', selector.attr('x'))
                .attr('y', selector.attr('y'))
                .attr('width', selector.attr('width'))
                .attr('height', selector.attr('height'))
                .style('fill', selector.style('fill'))
                .style('stroke', selector.style('stroke'))
                .style('stroke-width', selector.style('stroke-width'));

            dragSelector
                .transition().duration(70)
                .attr('x', curMouse[0]+DRAG_OFFSET)
                .attr('y', curMouse[1]+DRAG_OFFSET)
                .attr('width', DRAG_WH)
                .attr('height', DRAG_WH)

            DRAG_START = Date.now();
        }
        else
        {
            var dragSelector = d3.select('#dragSelector');
            if (Date.now() - DRAG_START < DRAG_TRANSITION) {
                dragSelector
                    .transition().duration(DRAG_TRANSITION - (Date.now() - DRAG_START))
                    .attr('x', curMouse[0]+DRAG_OFFSET)
                    .attr('y', curMouse[1]+DRAG_OFFSET)
                    .attr('width', DRAG_WH)
                    .attr('height', DRAG_WH)
                    //.on('end', function() { DRAG_TRANSITION_END = true; })
            }
            else {
                dragSelector
                    .attr('x', curMouse[0]+DRAG_OFFSET)
                    .attr('y', curMouse[1]+DRAG_OFFSET)
            }
        }
        LAST_MOUSE = curMouse;

    }
    function releaseSelector()
    {
        COLOR_DRAGGING = false;
        LAST_MOUSE = null;
        //d3.select('#dragSelector').remove();
    }

    (function(obj) {
        d3.select("#selectedColor")
            .on('mousedown', function()
            {
                obj.prompt.style('visibility', 'hidden');

                // highlight potential drop spots
                obj.highlightPotentialDrop(d3.select("#selectedColor").style('fill'));

                d3.select(document).on('mousemove.selector', function()
                {
                    // move the draggable color
                    dragSelected();
                    obj.manipulation = true;
                });
                d3.select(document).on('mouseup.selector', function()
                {
                    if (obj.userPrefs == 0) {
                        obj.prompt.style('visibility', null);
                    }

                    releaseSelector();

                    // clear potential drop spots
                    obj.highlightPotentialDrop();

                    // drop color
                    var inDropZone = obj.dropColor(d3.select("#selectedColor").style('fill'));

                    obj.manipulation = false;

                    // remove event handlers
                    d3.select(document).on('mousemove.selector', null);
                    d3.select(document).on('mouseup.selector', null);

                    if (inDropZone)
                    {
                        obj.triggerCallbacks();
                        obj.addCallback(getLuminanceProfile());
                    }
                })
            })
    })(_obj);
}

ColormapScaffold.prototype.copyUserPrefs = function()
{
    var copyPrefs = [];
    for (var i=0; i<this.userPrefs.length; i++) {
        copyPrefs.push(this.userPrefs[i].copy());
    }
    return copyPrefs;
}

ColormapScaffold.prototype.dropColor = function(color)
{
    // normalized


    var res = this.inDropZone();
    if (!res.inZone)
    {
        // color wasn't dropped in drop zone
        d3.select('#dragSelector').transition(DRAG_TRANSITION)
            .attr('x', d3.select("#selectedColor").attr('x'))
            .attr('y', d3.select("#selectedColor").attr('y'))
            .attr('width', d3.select("#selectedColor").attr('width'))
            .attr('height', d3.select("#selectedColor").attr('height'))
            .on('end', function() { d3.select(this).remove(); })

        return false;
    }
    else {
        var nPos = res.nPos;
        var cLab = d3.lab(color);

        d3.select('#dragSelector').remove()

        var start = nPos;
        var end = nPos + DEFAULT_BLOCK_SIZE;
        if (start < 0) {
            start = 0;
            end = start + DEFAULT_BLOCK_SIZE;
        }
        else if (end > 1) {
            end = 1;
            start = end - DEFAULT_BLOCK_SIZE;
        }

        // add color to desired position
        this.userPrefs.push(new ColorPreference(
            start,
            end,
            cLab,
        ));
        this.updateUserPrefs();

        return true;
    }
}

ColormapScaffold.prototype.removeColorPref = function(colorPrefBlock)
{

    if (Number.isInteger(colorPrefBlock))
    {
        var index = colorPrefBlock;
        colorPrefBlock = this.userPrefs[index];
        this.userPrefs.splice(index, 1);

    }
    else {
        for (var i=0; i<this.userPrefs.length; i++) {
            if (this.userPrefs[i] == colorPrefBlock) {
                this.userPrefs.splice(i, 1);
            }
        }
    }

    // remove from key-associated list
    for (key in this.keyIndexedPrefs) {
        if (this.keyIndexedPrefs.hasOwnProperty(key))
        {
            if (this.keyIndexedPrefs[key] == colorPrefBlock) {
                this.keyIndexedPrefs[key] = undefined;
            }
        }
    }

    if (this.userPrefs.length > 0)
    {
        this.prompt.style('visibility', 'hidden');
    }
    else {
        this.prompt.style('visibility', null);
    }

}

ColormapScaffold.prototype.addEditedColorPref = function(keyIndex, normIndex, solColor, priority)
{
    if (!priority) {
        // if no priority provided, use the maximum
        priority = MIN_BLOCK_SIZE * 1.5;
    }

    var start = normIndex-priority/2;
    var end = normIndex+priority/2;
    if (start < 0) {
        start = 0;
        end = start + priority;
    }
    else if (end > 1) {
        end = 1;
        start = end - priority;
    }

    var labColor = d3.lab(solColor[0], solColor[1], solColor[2]);

    // see if we've edited this key before. If so, just take the existing
    // color block as opposed to creating a new one
    var colorBlock = this.keyIndexedPrefs[keyIndex];
    if (!colorBlock) {
        colorBlock = new ColorPreference(start, end, labColor);
        this.userPrefs.push(colorBlock);
        //this.keyIndexedPrefs[keyIndex] = colorBlock;
    }
    else {
        // update
        colorBlock.start = start;
        colorBlock.end = end;
        colorBlock.color = labColor;
    }

    this.updateUserPrefs();
}

// cancels a scheduled optimization call
ColormapScaffold.prototype.cancelOpt = function()
{
    opt.cancelScheduledRun();
}

ColormapScaffold.prototype.triggerCallbacks = function()
{
    console.log('scaffold: triggerCallbacks');
    // schedule a re-run of optimization
    opt.scheduleReRun(true);
}

ColormapScaffold.prototype.layoutBlocks = function()
{
    if (!this.userPrefs || this.userPrefs.length == 0) {
        return;
    }
    var prefs = this.userPrefs;
    var levels = [];

    // remove earlier intersections
    for (var i=0; i<prefs.length; i++) {
        prefs[i].intersections = [];
    }

    // test all pref blocks against each other
    var levelsNeeded = 1;
    for (var i=1, len=prefs.length; i<len; i++)
    {
        for (var j=0; j<i; j++)
        {
            var b1 = prefs[i];
            var b2 = prefs[j];

            var s = b1.start
            var e = b1.end;

            if (b1.testIntersection(b2))
            {
                b1.intersections.push(b2);
                b2.intersections.push(b1);
                levelsNeeded = Math.max(Math.max(levelsNeeded, b1.intersections.length+1), b2.intersections.length+1);
            }
        }
    }



    // layout nodes, starting with least intersections
    var prefsOrdered = prefs.slice();
    prefsOrdered.sort(function(a, b) {

        var diff = a.intersections.length-b.intersections.length;
        if (diff == 0) {
            return a.serial-b.serial;
        }
        else {
            return diff;
        }
    });

    // fill in occupancy levels
    var complete = false;
    while (!complete)
    {
        // initialize level occupancy
        levels = [];
        for (var i=0; i<levelsNeeded; i++) {
            levels.push([]);
        }

        for (var i=0; i<prefsOrdered.length; i++)
        {
            var block = prefsOrdered[i];
            var levelsOccupied = levelsNeeded - block.intersections.length;

            // find starting level
            var done = false;
            for (var startLevel = 0; !done && startLevel <= levelsNeeded-levelsOccupied; startLevel++)
            {

                // check all levels needed for this block
                var foundFit = true;
                for (var l=startLevel; l<startLevel+levelsOccupied; l++)
                {
                    var thisLevel = levels[l];

                    // make sure there is space for this block
                    var notAvailable = false;
                    for (var j=0; j<thisLevel.length; j++)
                    {
                        var occupancy = thisLevel[j];
                        notAvailable = notAvailable || occupancy.testIntersection(block);
                    }
                    if (notAvailable) {
                        foundFit = false;
                        break;
                    }
                }

                if (foundFit) {
                    // mark occupany
                    for (var l=startLevel; l<startLevel+levelsOccupied; l++) {
                        var thisLevel = levels[l];
                        thisLevel.push(block);
                    }
                    block.startLevel = startLevel;
                    block.endLevel = startLevel + levelsOccupied - 1;
                    block.levelsOccupied = levelsOccupied;

                    block.h = block.levelsOccupied * (this.h / levelsNeeded);
                    block.y = block.startLevel * (this.h / levelsNeeded);
                    done = true;

                }
            }

            if (!done) {
                break;
                levelsNeeded++;//console.error("can not layout preference block: " + i);
            } else {
                complete = true;
            }
        }
    }

    return levels;
}

ColormapScaffold.prototype.updateAllGradients = function()
{

    if (this.userPrefs.length > 0)
    {
        this.prompt.style('visibility', 'hidden');
    }
    else {
        this.prompt.style('visibility', null);
    }

    var GRAD_STEP = 2;
    var selection = this.gradients.selectAll('image.userPrefGradient')
        .data(this.userPrefs);

    selection.exit().remove();
    selection = selection.enter()
        .append('image')
        .attr('class', 'userPrefGradient')
        .merge(selection);


    (function(totalWidth, totalHeight) {
        selection
            .attr('x', function(d) { return d.start*totalWidth })
            .attr('y', function(d) { return d.y; })
            .attr('width', function(d) { return (d.end-d.start)*totalWidth})
            .attr('height', function(d) { return d.h; })
            .attr('id', function(d) { return 'gradient_' + d.serial})
            .attr('xlink:href', function(d)
            {
                var w = Math.floor(+d3.select(this).attr('width'));
                var h = +d3.select(this).attr('height');

                var canvas = d.renderGradient(w, h, totalWidth);
                return canvas.toDataURL();
            })
    })(this.w, this.h)

    // update callbacks
    if (this.callbacks) {
        for (var i=0; i<this.callbacks.length; i++) {
            this.callbacks[i]();
        }
    }

}

ColormapScaffold.prototype.updateBlockHeights = function()
{
    if (this.userPrefs.length == 0) {
        return;
    }
    this.layoutBlocks();
    if (this.colorBlockSelection)
    {
        this.colorBlockSelection
            .attr('height', function(d) { return d.h; })
            .attr('y', function(d) { return d.y; });
    }
    this.updateAllGradients(this.userPrefs);
}

ColormapScaffold.prototype.setNewPrefs = function(newPrefs)
{
    var copied = [];
    for (var i=0; i<newPrefs.length; i++) {
        copied.push(newPrefs[i].copy());
    }

    this.storedPrefs = copied;
    this.updateUserPrefs(copied);
}
ColormapScaffold.prototype.flashUserPrefs = function(newPrefs)
{
    if (!this.storedPrefs) {
        this.storedPrefs = this.userPrefs;
    }
    this.updateUserPrefs(newPrefs);
}

ColormapScaffold.prototype.restoreUserPrefs = function()
{
    this.userPrefs = this.storedPrefs;
    this.updateUserPrefs();
    this.storedPrefs = null;
}


ColormapScaffold.prototype.updateUserPrefs = function(newPrefs)
{
    if (newPrefs) {
        this.userPrefs = newPrefs;
    }

    // compute block layout
    var levels = this.layoutBlocks();

    var selection = this.userPrefColors.selectAll('rect.userPrefColors')
        .data(this.userPrefs);

    var w = this.w;



    selection.exit().remove();
    selection = selection.enter()
        .append('rect')
        .attr('class', 'userPrefColors')
        .merge(selection);
    selection
        .attr('x', function(d) { return d.start*w })
        .attr('y', function(d) { return d.y; }/*0*/)
        .attr('width', function(d) { return (d.end-d.start)*w})
        .attr('height', function(d) { return d.h; }/*this.h*/)
        .style('stroke', 'black')
        .style('stroke-width', '1px')
        .style('fill', 'white')
        .style('fill-opacity', 0.0);
        //.style('fill', function(d) { return d.color.formatHex()});

    this.colorBlockSelection = selection;

    this.updateAllGradients();

    (function(selection, obj)
    {
        selection
            .on('mouseover', function(d)
            {
                if (obj.manipulation) {
                    return;
                }
                putNodeOnTop(this);
                d3.event.stopPropagation();

                // re-order
                d3.selectAll('rect.userPrefColors').each(function(d,i) {
                    d.order=i;
                });
                obj.userPrefs.sort(function(a, b) { return a.order-b.order;});
            })
            .on('mousemove', function(d)
            {
                if (obj.manipulation) return;
                var x = +d3.select(this).attr('x');
                var w = +d3.select(this).attr('width');
                var m = d3.mouse(obj.userPrefColors.node());

                m[0] -= x;
                if (m[0] < 5)
                {
                    obj.resizeTarget = {
                        d: d, node: this,
                        originalW: +d3.select(this).attr('width'),
                        originalX: +d3.select(this).attr('x'), edge:'left'
                    }
                    d3.select(this)
                        .style('cursor', 'col-resize');
                }
                else if (m[0] > 5 && m[0] > w-5) {
                    obj.resizeTarget = {
                        d: d, node: this,
                        originalW: +d3.select(this).attr('width'),
                        originalX: +d3.select(this).attr('x'), edge:'right'
                    }
                    d3.select(this)
                        .style('cursor', 'col-resize');
                }
                else {
                    obj.resizeTarget = null;
                    d3.select(this)
                        .style('cursor', null);
                }
            })
            .on('mousedown', function(d, i)
            {
                obj.cancelOpt();

                obj.manipulation = true;
                obj.mouseDown = d3.mouse(d3.select('#colormapDrop').node());
                COLOR_MOVING = true;

                if (!obj.resizeTarget)
                {
                    obj.moveTarget = {
                        index: i,
                        d: d, node: this, originalX: +d3.select(this).attr('x')
                    };
                    d3.select(document)
                        .on('mousemove.moveColors', function()
                        {
                            var m = d3.mouse(d3.select('#colormapDrop').node());
                            var dM = [m[0]-obj.mouseDown[0], m[1]-obj.mouseDown[1]];

                            //obj.mouseDown=m;
                            var targetBlock = d3.select(obj.moveTarget.node);
                            var newX = dM[0] + obj.moveTarget.originalX;

                            if (newX < 0) {
                                newX = 0;
                            }
                            else if (newX + +targetBlock.attr('width') > obj.w) {
                                newX = obj.w-targetBlock.attr('width');
                            }
                            targetBlock.attr('x', newX);
                            var _start = newX / obj.w;
                            var _end = (newX + +targetBlock.attr('width'))/obj.w;
                            obj.moveTarget.d.update(_start, _end);

                            // deal with tossing outside
                            var m2 = d3.mouse(obj.userPrefColors.node());
                            if (m2[1] < -20 || m2[1] > obj.h+20 || m2[0] < -20 || m[0] > obj.w+20)
                            {
                                targetBlock.style('opacity', 0.2);
                                d3.select("#gradient_" + obj.moveTarget.d.serial)
                                    .style('opacity', 0.2);
                                obj.moveTarget.trash = true;
                                d3.select('body').attr('class', 'trashCan');
                            }
                            else {
                                targetBlock.style('opacity', null);
                                d3.select("#gradient_" + obj.moveTarget.d.serial)
                                    .style('opacity', null);
                                obj.moveTarget.trash = false;
                                d3.select('body').attr('class', '');

                            }

                            // update heights
                            obj.updateBlockHeights();

                        })
                        .on('mouseup.moveColors', function()
                        {
                            COLOR_MOVING = false;
                            d3.select('body').attr('class', '');
                            obj.manipulation = false;
                            d3.select(document)
                                .on('mousemove.moveColors', null)
                                .on('mouseup.moveColors', null);

                            if (obj.moveTarget.trash)
                            {
                                // scan list of user pref colors and remove one
                                // that matches the trashed color
                                for (var j=0; j < obj.userPrefs.length; j++)
                                {
                                    if (obj.userPrefs[j].serial == obj.moveTarget.d.serial) {
                                        //obj.userPrefs.splice(j, 1);
                                        obj.removeColorPref(j);
                                    }
                                }

                                //obj.userPrefs.splice(obj.moveTarget.index, 1);
                                d3.select('#gradient_' + obj.moveTarget.d.serial).remove();
                                d3.select(obj.moveTarget.node)
                                    .transition().duration(100)
                                    .attr('width', 0).attr('height', 0)
                                    .on('end', function() {

                                        d3.select(this).remove();
                                        obj.updateBlockHeights();
                                        //obj.updateUserPrefs();

                                    });
                            }

                            // trigger callbacks
                            obj.triggerCallbacks();

                            obj.addCallback(getLuminanceProfile());
                        });
                }
                else {
                    d3.select(document)
                        .on('mousemove.moveColors', function()
                        {
                            // resize
                            var m = d3.mouse(d3.select('#colormapDrop').node());
                            var dM = [m[0]-obj.mouseDown[0], m[1]-obj.mouseDown[1]];
                            var targetBlock = d3.select(obj.resizeTarget.node);
                            var newX = obj.resizeTarget.originalX;
                            var newW = obj.resizeTarget.originalW;

                            if (obj.resizeTarget.edge=='left')
                            {
                                newX = dM[0] + obj.resizeTarget.originalX;
                                if (newX < 0) {
                                    newX = 0;
                                }
                                else if ((obj.resizeTarget.originalW + obj.resizeTarget.originalX-newX)/obj.w < MIN_BLOCK_SIZE)
                                {
                                    newX = -MIN_BLOCK_SIZE*obj.w + obj.resizeTarget.originalW + obj.resizeTarget.originalX;
                                }
                                targetBlock.attr('x', newX);
                                newW = obj.resizeTarget.originalW + obj.resizeTarget.originalX-newX;
                                targetBlock.attr('width',  newW);
                            }
                            else
                            {
                                newW = dM[0] + obj.resizeTarget.originalW;
                                if (newW < MIN_BLOCK_SIZE*obj.w) {
                                    newW = MIN_BLOCK_SIZE*obj.w;
                                }
                                else if (obj.resizeTarget.originalX + newW > obj.w) {
                                    newW = obj.w - obj.resizeTarget.originalX;
                                }
                                targetBlock.attr('width', newW);
                            }
                            var _start = newX / obj.w;
                            var _end = (newX + newW)/obj.w;
                            obj.resizeTarget.d.update(_start, _end);

                            // update heights
                            obj.updateBlockHeights();
                        })
                        .on('mouseup.moveColors', function()
                        {
                            COLOR_MOVING = false;
                            obj.manipulation = false;
                            d3.select(document)
                                .on('mousemove.moveColors', null)
                                .on('mouseup.moveColors', null);

                            // triger callbacks
                            obj.triggerCallbacks();

                            obj.addCallback(getLuminanceProfile());
                        });
                    }
            });
    })(selection, this);
}


ColormapScaffold.prototype.inDropZone = function(mouse)
{
    if (!mouse) {
        mouse = d3.mouse(this.svg.node());
    }

    var xMin = +this.rect.attr('x'), xMax = +this.rect.attr('x') + +this.rect.attr('width');
    var yMin = +this.rect.attr('y'), yMax = +this.rect.attr('y') + +this.rect.attr('height');

    var inZone =
        mouse[0] >= xMin && mouse[0] <= xMax &&
        mouse[1] >= yMin && mouse[1] <= yMax;

    return {
        nPos: (mouse[0]-xMin) / (xMax-xMin),
        inZone: inZone
    };
}

ColormapScaffold.prototype.highlightPotentialDrop = function(color)
{
    var DROP_H_DIFF = 10;
    if (!color) {
        this.highlights.selectAll('rect.potentialDrop').remove();
        return;
    }

    var potentialDrops = this.getDropRange(color);

    var w = this.w;
    var h = this.h;

    var selection = this.highlights.selectAll('rect.potentialDrop')
        .data(potentialDrops)
    selection = selection.enter().append('rect')
        .attr('class', 'potentialDrop')
        .merge(selection);

    selection
        .attr('x', function(d) { return d[0]*w})
        .attr('width', function(d) {
            var xMin = d[0]*w;
            var xMax = d[1]*w;
            return xMax-xMin;
        })
        .attr('y', DROP_H_DIFF/2)
        .attr('height', this.h - DROP_H_DIFF)
        .style('fill', color);
    selection.exit().remove();
}

ColormapScaffold.prototype.getDropRange = function(color)
{
    var c = d3.lab(color);
    var minL = c.l;
    var maxL = c.l;

    var inRange = false;
    var segments = [], curSegment = null;
    var luminanceGenerator = getLuminanceProfile();

    for (var i=0, steps=1000; i<=steps; i++)
    {
        var key = i/steps;
        c.l = luminanceGenerator.getLuminance(key);
        if (c.displayable())
        {
            if (!inRange) {
                inRange = true;
                curSegment = [key, key];
            }
            else {
                curSegment[1] = key;
            }
        }
        else {
            if (inRange) {
                segments.push(curSegment);
                curSegment = null;
                inRange = false;
            }
        }
    }
    if (curSegment) {
        curSegment[1] = 1;
        segments.push(curSegment);
    }
    return segments;
}

ColormapScaffold.prototype.getUserPrefs = function()
{
    return this.userPrefs;
}
