$( document ).ready(function() {

    // Toggle form fields 

    $('#formFieldsBtn').click(function() {
        $('#formFieldsContent').toggle();
    });

    // Parameter fields 

    var runtimeSlider = $('#max-runtime').slider({
        min: 0,
        max: 180,
        value: 60,
        step: 1,
        formatter: function(value) {
            return 'Runtime: ' + value;
        }
    });
});

function updateRuntime(val) {
    document.getElementById('show-runtime').value = val;
}

function updateTemp(val) {
    document.getElementById('show-temp').value = val;
}