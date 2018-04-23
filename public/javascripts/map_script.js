console.log("This is the map script");

$( document ).ready(function() {
    var map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([-120.8958, 38.8375]),
                zoom: 6
            })
    });
});

