var express = require('express');
var router = express.Router();
var fs = require('fs');

// Javascript implementation of EDN for Clojure
var edn = require('jsedn');

// Connection to PostgreSQL / PostGIS 
var pg = require("pg");
// var connectPostgres = "postgres://USERNAME:PASSWORD@127.0.0.1/dbname";

/* 
// GET map page 
router.get('/map', function(req, res) {
    var client = new pg.Client(connectPostgres);
    client.connect();
    var query = client.query("SELECT lname FROM sample_layer");
    query.on("row", function(row, result) {
        result.addRow(row);
    });

    query.on("end", function(result) {
        res.render('map', {
            "layers": (result.rows),
            title: 'GridFire.ui',
            lat: 40.7795213,
            lng: -73.9641241
        });
    });
});
*/

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'GridFire Interface', exPost: null, error: null });
});

/* POST event */
router.post('/', function(req, res) {

    console.log("POST event here.");

    /* Parameters for GridFire Clojure model 
        ignition-row
        ignition-col
        max-runtime
        temperature
        relative-humidity
        wind-speed-20ft
        wind-from-direction
        foliar-moisture
        ellipse-adjustment-factor
        simulations
        random-seed
    */

    /* Send POST to .edn file for Clojure */

    try {
        var ignitionRow = req.body['ignition-row'];
        var ignitionCol = req.body['ignition-col'];
        var maxRuntime = req.body['max-runtime'];
        var temperature = req.body['temperature'];
        var relativeHumidity = req.body['relative-humidity'];
        var windSpeed20ft = req.body['wind-speed-20ft'];
        var windFromDirection = req.body['wind-from-direction'];
        var foliarMoisture = req.body['foliar-moisture'];
        var ellipseAdjustmentFactor = req.body['ellipse-adjustment-factor'];
        var simulations = req.body['simulations'];
        var randomSeed = req.body['random-seed'];

        // Convert JS to EDN 
        var exEdn = edn.encode({
            ignitionRow: ignitionRow,
            ignitionCol: ignitionCol,
            maxRuntime: maxRuntime,
            temperature: temperature,
            relativeHumidity: relativeHumidity,
            windSpeed20ft: windSpeed20ft
        });

        fs.writeFile('sample_params.edn', exEdn, function(err, exEdn) {
            if (err) console.log(err);
            console.log('Wrote to file.');
        });

        console.log("\nParameters for Clojure GridFire\n---------------\n")
        console.log("req.body: ", req.body);
        console.log("exEdn: ", exEdn);
        console.log("\n---------------\n");

        res.render('index', { title: 'GridFire Interface', exPost: ignitionRow, error: null });

    } catch(err) {
        res.render('index', { title: 'GridFire Interface', exPost: null, error: 'Error, please try again!' });
    }
})

module.exports = router;
