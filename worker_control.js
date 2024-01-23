function ThreadedOptimizer(workerCount, initialTemp, iterationsPerTemp, taperWalkLen, initialSolution)
{
    this.controller = new WorkerControl(workerCount);

    // specify additional parameters
    if (initialTemp) {
        this.controller.initialTemp = initialTemp;
    }

    if (iterationsPerTemp) {
        this.controller.iterationsPerTemp = iterationsPerTemp;
    }
    if (taperWalkLen) {
        this.controller.taperWalkLen = taperWalkLen;
    }
    if (initialSolution) {
        this.controller.initialSolution = initialSolution;
    }

    // initial solution
}

ThreadedOptimizer.prototype.run = function(callback)
{
    this.controller.startWork(callback);
}
ThreadedOptimizer.prototype.stop = function()
{
    this.controller.stopWork();
}

ThreadedOptimizer.prototype.getRemainingSeconds = function()
{
    return this.controller.secondsRemaining;
}

ThreadedOptimizer.prototype.getFirstSolution = function()
{
    if (this.controller.solutions && this.controller.solutions[0]) {
        return this.controller.solutions[0].solution;
    }
    else {
        return null;
    }
}


function WorkerControl(workerCount)
{
    this.workerCount = workerCount;

    this.workers = [];

    // create worker thread and add to list
    for (var i=0; i<workerCount; i++) {
        var thread = new Worker('worker.js');
        this.workers.push(thread);
    }
}
WorkerControl.prototype.stopWork = function()
{
    if (this.workers)
    {
        for (var i=0; i<this.workers.length; i++)
        {
            //this.workers[i].postMessage({terminate: true});
            this.workers[i].terminate();
        }
        this.workers = null;
    }
}
WorkerControl.prototype.terminate = function() {
    this.stopWork();
}

WorkerControl.prototype.startWork = function(callback, initialSolution)
{
    // create package for workers
    var cvdModel = getCVDModel();
    var workerData =
    {
        luminanceProfile: getLuminanceProfile().getProfileType(),
        LRANGE: LRANGE,
        smoothness: SMOOTHNESS,
        desiredKeys: DESIRED_KEYS,
        exitEvery: this.updateEvery !== undefined ? this.updateEvery : UPDATE_EVERY,
        iterationsPerTemp: ITERATIONS_PER_TEMP,
        minBlockSize: MIN_BLOCK_SIZE,
        maxPrefStrength: MAX_PREF_STRENGTH,
        cvdModel: cvdModel ? cvdModel.modelName : null,

        // additional parameters to control starting temperature
        initialTemp: this.initialTemp,
        alpha: this.alpha,
        taperWalkLen: this.taperWalkLen,

        // initial solution
        initialSolution: this.initialSolution

    };

    // figure out bias vector
    var userModel = new UserModel(scaffold ? scaffold.getUserPrefs() : null);
    workerData.userBias = userModel.getBias();

    this.solutions = [];
    this.readyCount = 0;

    this.startTime = Date.now();
    var workerCount = this.workerCount;
    for (var i=0; i<workerCount; i++)
    {
        // solution placeholder
        this.solutions.push(null);
    }

    // add callbacks
    for (var i=0; i<workerCount; i++)
    {
        (function(thread, _workerData, index, obj)
        {

            // collect messages from workers
            thread.onmessage = function(msg)
            {
                var data = msg.data;
                var final = false;
                obj.solutions[index] = data;

                // estimate remaining time
                obj.estimateTimeRemaining();

                if (data.complete)
                {
                    obj.readyCount++;
                    if (obj.readyCount == workerCount)
                    {
                        final = true;
                    }
                }
                // notify callbacks
                if (callback) {
                    callback(obj.solutions, final);
                }
            }

            // send task
            workerData.workerIndex = index;
            thread.postMessage(workerData)

        })(this.workers[i], workerData, i, this);
    }
}

WorkerControl.prototype.estimateTimeRemaining = function()
{
    this.secondsRemaining = undefined;
    if (this.readyCount!=this.workers.length) {
        var percentDone = 0;
        var doneAssess = 0;
        for (var i=0; i<this.solutions.length; i++)
        {
            if (this.solutions[i] !== null) {
                doneAssess++;
                percentDone += this.solutions[i].percentDone;
            }
        }

        if (doneAssess>0)
        {
            var workerCount = this.workers.length;
            var timeRemaining = ((workerCount-percentDone) / percentDone) * (Date.now() - this.startTime);
            var seconds = Math.ceil(timeRemaining / 1000);
            this.secondsRemaining = seconds;
        }
    }
    else {
        // all workers complete
    }

}

var SOLUTION_SIMILARITY_THRESHOLD = 120;    // in CIELAB units
function solutionDistance(sol1, sol2)
{
    var diff = 0;
    for (var i=0; i<sol1.length; i++) {
        var c1 = sol1[i];
        var c2 = sol2[i];
        var d = Math.sqrt(
            Math.pow(c1[0]-c2[0], 2) +
            Math.pow(c1[1]-c2[1], 2) +
            Math.pow(c1[2]-c2[2], 2)
        );
        diff += d;
    }
    return diff;
}

WorkerControl.prototype.aggregate = function()
{
    // test the similarity of solutions
    var sims = [];

    for (var i=1; i<this.solutions.length; i++) {
        for (var j=0; j<i; j++) {
            var sol1 = this.solutions[i];
            var sol2 = this.solutions[j];

            var similarity = calcDistance(sol1, sol2)
        }
    }
}
