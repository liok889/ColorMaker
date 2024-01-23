
// update with partial solution every
var UPDATE_EVERY = 200; // 0.15 second


function colormapFromSolution(solution)
{
    var colorset = [];
    for (var i=0, len=solution.length; i<len; i++) {
        var c = solution[i];
        var p = {
            value: i/(len-1),
            lab: {
                l: c[0],
                a: c[1],
                b: c[2]
            }
        }
        colorset.push(p);
    }
    return new ColorMap(colorset, 'lab');
}

function colormapToImage(colormap, imageSelection, direction)
{
    var canvas = colormap.drawColorScale(
        +imageSelection.attr('width'),
        +imageSelection.attr('height'),
        +imageSelection.attr('width'),
        direction || 'horizontal'
    )
    imageSelection.attr("xlink:href", canvas.toDataURL());
}


function OptimizerWrapper(_scaffold)
{
    // get a luminance profile (defaults to what's in the interface)
    this.callbacks = [];
    this.scaffold = _scaffold;
    this.optimizer = new Optimizer();
    this.userModel = new UserModel();
    this.plotSolution();
    this.plotCurvesNew();
}

OptimizerWrapper.prototype.cancelScheduledRun = function()
{
    if (this.reRunTimeout !== undefined)
    {
        clearTimeout(this.reRunTimeout);
        this.reRunTimeout = undefined;
    }

    if (this.running)
    {
        d3.select("#statusText").html('');
        this.stop();
    }
}

OptimizerWrapper.prototype.scheduleReRun = function(fullRun, instant)
{
    const RE_RUN_WAIT = instant ? 15 : 1500;

    // stop existing run
    if (this.running) {
        d3.select("#statusText").html('');
        this.stop();
    }
    if (this.reRunTimeout !== undefined) {
        clearTimeout(this.reRunTimeout);
        this.reRunTimeout = undefined;
    }
    (function(obj) {
        obj.reRunTimeout = setTimeout(function()
        {
            obj.reRunTimeout = undefined;
            if (fullRun) {
                obj.run();
            } else {
                obj.reRun();
            }
        }, RE_RUN_WAIT);
    })(this);
}
OptimizerWrapper.prototype.reRun = function()
{
    // re-runs a short cycle of the optimization starting with last solution
    var shortCycle = true;

    if (!this.solution) {
        // if no previous solution, need a full cycle
        shortCycle = false;
    }
    this.threaded(1, shortCycle);
}

OptimizerWrapper.prototype.run = function(workerCount)
{
    this.threaded(workerCount);
}

OptimizerWrapper.prototype.getSolution = function() {
    if (!this.solution) {
        return this.optimizer.getSolution();
    } else {
        return this.solution;
    }
}

var WORKER_COUNT = 1;
OptimizerWrapper.prototype.threaded = function(_workers, shortCycle)
{
    var workerCount = _workers || WORKER_COUNT;

    var initialTemp = shortCycle ? 0.01 : null;
    var iterationsPerTemp = shortCycle ? Math.ceil(ITERATIONS_PER_TEMP*2.5) : null
    var taperWalkLen = shortCycle ? .5 : null;
    var initialSolution = shortCycle && this.solution ? this.solution : null;

    this.threadedOpt = new ThreadedOptimizer(
        workerCount,
        initialTemp,
        iterationsPerTemp,
        taperWalkLen,
        initialSolution
    );

    this.running = true;
    this.secondsRemaining = undefined;

    (function(optObj) {
        optObj.threadedOpt.run(function(solutions, final)
        {
            optObj.secondsRemaining = optObj.threadedOpt.getRemainingSeconds();
            if (final)
            {
                // clean up
                optObj.threadedOpt.stop();

                optObj.running = false;
                optObj.secondsRemaining = undefined;
                for (var i=solutions.length-1; i>=0; i--) {
                    if (i>0) {
                        hist.add(solutions[i].solution, solutions[i].solutionCost);
                    }
                }
                optObj.uneditedSolution = copySolution(solutions[0].solution);
            }

            // notify callbacks
            for (var i=0; i<optObj.callbacks.length; i++) {
                if (solutions[0])
                {
                    optObj.solution = solutions[0].solution;
                    optObj.callbacks[i](final);
                    optObj.plotSolution();
                }
            }
        });
    })(this)
}

OptimizerWrapper.prototype.getRemainingSeconds = function()
{
    return this.secondsRemaining;
}

OptimizerWrapper.prototype.optimizerLoop = function()
{
    // update user model based on preferences provided
    this.userModel = new UserModel(this.scaffold ? this.scaffold.getUserPrefs() : null);
    this.userBias = this.userModel.getBias();

    // indicate as running
    this.running = true;

    // run optimizer
    var terminated = this.optimizer.optimize(this.userBias, UPDATE_EVERY);

    // get (partial) solution and plot
    this.solution = this.optimizer.getSolution();
    this.plotSolution();

    // notify callbacks
    for (var i=0; i<this.callbacks.length; i++) {
        this.callbacks[i](terminated || this.stopped)
    }

    // reset time
    this.secondsRemaining = undefined;

    if (!terminated)
    {
        // this is a partial solution
        if (!this.paused && !this.stopped)
        {
            // estimate remaining time
            var optimizerState = this.optimizer.lastState;
            var percentDone = optimizerState.percentDone;
            var timeRemaining = ((1-percentDone) / percentDone) * (Date.now() - optimizerState.startTime);
            var seconds = Math.ceil(timeRemaining / 1000);
            this.secondsRemaining = seconds;


            // schedule another call in 10 milli seconds
            (function(_this) {
                setTimeout(function()
                {
                    _this.optimizerLoop();
                }, 15);
            })(this);
        }
        else if (this.stopped)
        {

            this.stopped = false;
            this.running = false;

            // clear optimizer state
            this.optimizer.clearLastState();
        }
        else {
            // paused
            this.paused = false;
            this.running = false;
        }
    }
    else
    {
        /*
        d3.select('#statusText')
            .html(null);
        */

        this.running = false;
    }
    this.uneditedSolution = copySolution(this.solution);
    return this.solution;
}
OptimizerWrapper.prototype.pause = function() {
    this.paused = true;
}
OptimizerWrapper.prototype.stop = function()
{
    if (this.threadedOpt && this.isRunning()) {
        this.threadedOpt.stop();
        this.running = false;

        var firstSolution = this.threadedOpt.getFirstSolution();
        if (firstSolution) {
            this.uneditedSolution = copySolution(firstSolution);
            this.solution = copySolution(firstSolution);
            //this.deliverSolution(firstSolution);
        }
    }
    this.stopped = true;
}

OptimizerWrapper.prototype.isRunning = function() {
    return this.running === true;
}


OptimizerWrapper.prototype.addCallback = function(callback)
{
    this.callbacks.push(callback);
}

OptimizerWrapper.prototype.getColorMap = function() {
    return this.colormap;
}

OptimizerWrapper.prototype.editKey = function(keyIndex, solColor)
{
    this.solution[keyIndex] = solColor;
    this.updateColormap();

    // update examples
    examples.setColorMap(this.getColorMap());
}


OptimizerWrapper.prototype.unedit = function()
{
    this.solution = copySolution(this.uneditedSolution);
    this.updateColormap();

    // update examples
    examples.setColorMap(this.getColorMap());
}

OptimizerWrapper.prototype.plotCurvesNew = function()
{
    if (this.plots) {
        this.plots.dispose();
        this.plots = null;
    }

    this.plots = new CurvePlotCollection(d3.select("#colormapStats"), getColorSpace());
    if (!this.solution) {
        return;
    }
    this.plots.updateSolution(this.solution);
    (function(obj) {
        obj.plots.setEditCallback(function(solution)
        {
            this.solution = solution;
            obj.updateColormap();

            // update example colors
            examples.setColorMap(obj.getColorMap());
        });

        // define a callback in response to local edits
        obj.plots.setUpdateCallback(function(solution, editedIndex)
        {
            // add bead index as a new hard key
            //obj.userModel.addHardKey(beadIndex, solution[beadIndex])

            // add edit key as a user preference
            var normKeyIndex = editedIndex / (solution.length-1);
            var editedColor = solution[editedIndex];
            obj.scaffold.addEditedColorPref(editedIndex, normKeyIndex, editedColor)

            // schedule re-run of optimization
            obj.scheduleReRun();
        })
    })(this);
}

OptimizerWrapper.prototype.updateColorSpace = function()
{
    this.plotCurvesNew();
}

OptimizerWrapper.prototype.deliverSolution = function(solution)
{
    this.uneditedSolution = copySolution(solution);
    this.updateSolution(solution);

    for (var i=0; i<this.callbacks.length; i++) {
        this.callbacks[i](true);
    }


}

OptimizerWrapper.prototype.updateSolution = function(solution)
{
    if (solution) {
        this.solution = solution;
        this.uneditedSolution = copySolution(solution);
    }
    this.plotSolution();
}

OptimizerWrapper.prototype.updateColormap = function()
{
    this.colormap = colormapFromSolution(this.solution);
    colormapToImage(this.colormap, d3.select("#colormapImage"));
}

OptimizerWrapper.prototype.plotSolution = function()
{
    if (!this.solution) {
        return;
    }

    // visualize colormap
    this.updateColormap();

    this.plotCurvesNew();
}
