$( document ).ready(function() {

    // Toggle form fields 

    $('#formFieldsBtn').click(function() {
        $('#formFieldsContent').toggle();
    });

    // Initiate runtime slider 

    /*var runtimeSlider = $('#max-runtime').slider({
        min: 0,
        max: 180,
        value: 60,
        step: 1,
        formatter: function(value) {
            return 'Runtime: ' + value;
        }
    });*/

    $('input[type="radio"]').on('click change', function(e) {
        console.log("\nRadio button change");

        if (document.getElementById('single-burn-radio').checked) {
            document.getElementById('single-burn-coords').style.display = 'block';
            document.getElementById('random-burn-coords').style.display = 'none';
        } else if (document.getElementById('random-burn-radio').checked) {
            document.getElementById('single-burn-coords').style.display = 'none';
            document.getElementById('random-burn-coords').style.display = 'block';
        }
    });
});