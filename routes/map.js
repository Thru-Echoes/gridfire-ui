var express = require('express');
var router = express.Router();

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

/* GET map page. */
router.get('/map', function(req, res, next) {
    res.render('map');
});

module.exports = router;
