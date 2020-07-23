$(document).ready(function(){
    $('.slider').bxSlider({
        infiniteLoop: true,
        pager: true,
        controls: false,
        touchEnabled: true,
        auto: true,
    });
    $('.slider2').bxSlider({
        infiniteLoop: false,
        hideControlOnEnd: true,
        pager: false,
        controls: true,
        touchEnabled: true,
    });
});

