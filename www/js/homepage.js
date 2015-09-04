var legendSlots = 20;
var majorCurrencies = 6; //first X currencies in the config are major

var API_data = {};
if (typeof config.apiIndexUrl == 'undefined' || config.apiIndexUrl == ''){
    alert('API URL config value empty!');
}
if (config.apiIndexUrl[config.apiIndexUrl.length-1] != '/') {
    config.apiIndexUrl = config.apiIndexUrl + '/';
}
var API_all_url = config.apiIndexUrl+'all';

if (config.apiHistoryIndexUrl[config.apiHistoryIndexUrl.length-1] != '/') {
    config.apiHistoryIndexUrl = config.apiHistoryIndexUrl + '/';
}

var active_API_URL = API_all_url;

var selectedFiatCurrency = false;
var firstRenderDone = false;
var apiDataUpdated = false;
var fiatExchangeRates = [];
var fiatCurrencies = {};
var timeGap = 0; //actual time is fetched from server, and user's local time is adjusted by X seconds to be completely exact

var callAPI = function(callback){
    if (typeof callback == 'undefined'){
        callback = renderAll;
    }

    if (window.XDomainRequest) {
        var xhr = new window.XDomainRequest(); //IE9-10 implements crossdomain AJAX this way only
        xhr.open('GET', active_API_URL, true);
        xhr.onload = function() {
            var result = JSON.parse(xhr.responseText);
            callback(result);
        };
        xhr.send();
    } else {
        $.getJSON(active_API_URL, callback);
    }
};

var renderAll = function(result, status, responseObj){
    result = adjustScale(result, config.scaleDivizer);

    //responseObj is not available in IE
    if(typeof responseObj == 'object'){
        timeGap = getTimeGap(responseObj.getAllResponseHeaders());
    }

    apiDataUpdated = (API_data['timestamp'] != result['timestamp']);

    API_data = result;

    renderUpdateTime();

    if (!firstRenderDone) {
        var currencyCode = window.location.hash;
        currencyCode = currencyCode.slice(1);
        currencyCode = currencyCode.split('-')[0];

        // if currency hash isn't defined
        if(typeof fiatCurrencies[currencyCode] == 'undefined'){
            currencyCode = config.currencyOrder[0];
        }

        renderSelect(currencyCode);
        $('.currency-navigation').children("[data-currencycode='" + currencyCode + "']").click();
        selectedFiatCurrency = currencyCode;

        var isPrimaryCurrency = isCurrencyBelongsToPrimaryList(currencyCode);
        if (!isPrimaryCurrency){
            $('.more-currencies').click();
        }

        var baseCookie = $.cookie('base');
        if (baseCookie == 'millibitcoin') {
            $('#base-switch-button').click();
        } else {
            $.cookie('base', 'bitcoin', {expires: 365});
        }

        $('body').show();
        firstRenderDone = true;
    } else {
        renderSelect(selectedFiatCurrency);
    }
};

var renderSelect = function(currencyCode) {
    var isPrimaryCurrency = isCurrencyBelongsToPrimaryList(currencyCode);
    if(isPrimaryCurrency){
        $('.highcharts-container').show();
        renderLegend(currencyCode);
        renderSmallChart(currencyCode);
        $('.calculator-currency-switch').slideUp();
        $('#global-last').html(API_data[currencyCode].global_averages.last.toFixed(config.precision));
    } else {
        renderLegendForExtendedCurrencyList(currencyCode);
    }
};

var renderMarketsData = function(apiData, currency){
    var globalAverageData = JSON.parse(JSON.stringify(apiData));
    globalAverageData = $.map(globalAverageData, function(value, index) {
        value['currency'] = index;
        return [value];
    });
    globalAverageData.splice(-2, 2); // delete timestamp and ignored_exchanges from data
    globalAverageData.sort(function(a, b) {
        if (a['global_averages']['volume_percent'] == b['global_averages']['volume_percent'] ) {
            return 0;
        } else if (a['global_averages']['volume_percent'] < b['global_averages']['volume_percent']) {
            return 1;
        }
        return -1;
    });

    var html='';
    var allVolumeBtc = 0;
    $.each(globalAverageData, function (i, item) {
        var currencyCode = item['currency'];
        var volumeBtc = item['global_averages']['volume_btc'];
        allVolumeBtc += parseFloat(volumeBtc);

        if (currencyCode == currency){
            $('#legend-currency-trading-volume').html(volumeBtc)
                                                .formatCurrency({   symbol: '',
                                                    positiveFormat: '%n',
                                                    negativeFormat: '-%s%n',
                                                    roundToDecimalPlace: 2
                                                    });
        }

        var volumePercent = item['global_averages']['volume_percent'].toFixed(2);
        var pad = "00000";
        // volumePercent = pad.substring(0, pad.length - volumePercent.length) + volumePercent;
        if (parseFloat(volumePercent) < 0.01) {
            volumePercent = '< 0.01';
        }

        var lastPrice = item['averages']['last'].toFixed(config.precision);
        var cookieHideLink = $.cookie("global-average-table");
        var oneRow = $('<tr></tr>');
        if (i > config.majorCurrencies) {
            if (cookieHideLink == null) cookieHideLink = 'hidden';
            if (cookieHideLink == 'hidden') {
                oneRow.addClass('secondary-global-avg-row hidden');
                $('#show-more-currencies-in-global-avg-table').text('more');
            } else if (cookieHideLink == 'collapsed') {
                oneRow.addClass('secondary-global-avg-row');
                $('#show-more-currencies-in-global-avg-table').text('less');
            }
        }
        oneRow.attr('id', 'global-average-data' + currencyCode);

        /* Currency NAME */
        var aLegendCurrency = $('<a></a>');
        var tdLegendCurrency = $('<td></td>');
        aLegendCurrency.attr('href', 'markets.htm#' + currencyCode);
        aLegendCurrency.text(currencyCode);
        tdLegendCurrency.attr('class', 'legend-currency');
        tdLegendCurrency.append(aLegendCurrency);
        oneRow.append(tdLegendCurrency);

        /* Volume Percent */
        var spanVolumePercent = $('<span></span>');
        var tdVolumePercent = $('<td></td>');
        spanVolumePercent.text(volumePercent);
        tdVolumePercent.attr('class', 'legend-volume_percent');
        tdVolumePercent.append(spanVolumePercent);
        oneRow.append(tdVolumePercent);

        /* Volume BTC */
        var spanVolumeBtc = $('<span></span>');
        var tdVolumeBtc = $('<td></td>');
        spanVolumeBtc.text(volumeBtc);
        spanVolumeBtc.formatCurrency({   symbol: '',
                            positiveFormat: '%n',
                            negativeFormat: '-%s%n',
                            roundToDecimalPlace: 2
                            });
        tdVolumeBtc.attr('class', 'legend-volume_btc text-right');
        tdVolumeBtc.append(spanVolumeBtc);
        oneRow.append(tdVolumeBtc);

        /* Last Price */
        var spanLastPrice = $('<span></span>');
        var tdLastPrice = $('<td></td>');
        spanLastPrice.text(lastPrice);
        tdLastPrice.attr('class', 'legend-price text-right');
        tdLastPrice.append(spanLastPrice);
        oneRow.append(tdLastPrice);

        /* Last Price Currency Code*/
        var spanCurCode = $('<span></span>');
        var tdCurCode = $('<td></td>');
        spanCurCode.text(currencyCode);
        tdCurCode.attr('class', 'legend-price');
        tdCurCode.append(spanCurCode);
        oneRow.append(tdCurCode);

        /* Cross Price */
        var spanCrossPrice = $('<span></span>');
        var tdCrossPrice = $('<td></td>');
        var insLegendCurcode = $('<ins></ins>');

        insLegendCurcode.text(currency);
        insLegendCurcode.attr('class', 'legend-curcode');
        tdCrossPrice.attr('class', 'legend-last-cross-price text-right');
        tdCrossPrice.append(spanCrossPrice);
        tdCrossPrice.append(insLegendCurcode);
        oneRow.append(tdCrossPrice);

        html += oneRow.outerHTML();
    });

    var table = $('#global-average-data-table');
    table.children('tbody').html(html);

    $('.main-volume .volume').text(allVolumeBtc).formatCurrency({
        symbol: '฿',
        positiveFormat: '%s %n',
        roundToDecimalPlace: 2
    });
};


var renderLegend = function(currencyCode){
    $('.highcharts-container').show();
    renderMarketsData(API_data, currencyCode);

    $('#global-curcode').text(currencyCode);
    $('#global-cursym').text(getCurrencySymbol(currencyCode));

    var exchangeArray = [];
    var currencyData = API_data[currencyCode];

    var index = 0;
    for(var exchange_name in currencyData.exchanges){
        currencyData.exchanges[exchange_name]['name'] = exchange_name;
        exchangeArray[index] = currencyData.exchanges[exchange_name];
        index++;
    }

    exchangeArray.sort(function(a, b){
        if(parseFloat(a.volume_percent) < parseFloat(b.volume_percent)){
            return 1;
        } else {
            return -1;
        }
    });

    var globalLast = currencyData.global_averages.last.toFixed(config.precision);

    if(selectedFiatCurrency == currencyCode){
        document.title = globalLast + ' ' + currencyCode + ' | BitcoinAverage Price Index';
    }

    // Main price
    $('#global-last').html(globalLast);
    $('#legend-last').html(globalLast);

    $('.legend-curcode').text(currencyCode);

    $('.bitcoin-calc .currency-label').text(currencyCode);
    $('.bitcoin-calc .currency-label').append($('<i class="glyphicon glyphicon-chevron-down"></i>'));

    var bitCoinInputValue = $('#bitcoin-input').toNumber().val();
    calc_renderBitcoin(bitCoinInputValue, $.cookie('base'));
    calc_renderFiat(globalLast * bitCoinInputValue);

    $('#legend-bid').html(currencyData.global_averages.bid.toFixed(config.precision));
    $('#legend-ask').html(currencyData.global_averages.ask.toFixed(config.precision));

    // 24h sliding average
    if (typeof currencyData.global_averages['24h_avg'] != 'undefined') {
        var g24hAverage = currencyData.global_averages['24h_avg'].toFixed(config.precision);
        $('.main-market-avg .market-24h-avg').text(g24hAverage).formatCurrency({
            symbol: getCurrencySymbol(currencyCode),
            positiveFormat: '%s%n ' + currencyCode,
            roundToDecimalPlace: config.precision
        });
        $('#legend-24h-avg').html(g24hAverage);
        $('#legend-24h-avg-container').show();
    } else {
        $('#legend-24h-avg-container').hide();
    }

    // Market average
    var marketAverage = currencyData.averages.last;
    $('.main-market-avg .market-cur-avg-title').text(currencyCode + ' market average');
    $('.main-market-avg .market-cur-avg').text(marketAverage).formatCurrency({
        symbol: getCurrencySymbol(currencyCode),
        positiveFormat: '%s%n ' + currencyCode,
        roundToDecimalPlace: config.precision
    });

    if ($(API_data.ignored_exchanges).countObj() == 0) {
        $('#show-ignored').hide();
    } else {
        $('#legend-ignored-table tr[id^="legend-ignored-slot"]').hide();

        var index = 0;
        for (var exchange_name in API_data.ignored_exchanges) {
            $('#legend-ignored-slot'+index+'-name').text(exchange_name);
            $('#legend-ignored-slot'+index+'-reason').html(API_data.ignored_exchanges[exchange_name]);
            $('#legend-ignored-slot'+index+'-box').show();
            index++;
        }
        $('#ignored_count').text(index);
    }

    // $('.legend-currency-code-update').html(fiatCurrencies[currencyCode]['name']);

    $('#legend-global-average').html(currencyData.global_averages.last.toFixed(config.precision))
    $('#legend-global-volume-percent').html(currencyData.global_averages.volume_percent.toFixed(2))


    for(var slotNum=0;slotNum<legendSlots;slotNum++){
        $('#legend-slot'+slotNum).toggle(false);
    }
    $('#legend-other').toggle(false);

    var otherCount = 0;
    var otherPercent = 0;
    var otherVolume = 0;

    $('#legend-api-unavailable-note').hide();
    $('#legend-api-down-note').hide();

    $('#24h-sliding-link').attr('href', config.apiHistoryIndexUrl+currencyCode+'/per_minute_24h_sliding_window.csv');
    $('#monthly-sliding-link').attr('href', config.apiHistoryIndexUrl+currencyCode+'/per_hour_monthly_sliding_window.csv');
    $('#daily-averages-link').attr('href', config.apiHistoryIndexUrl+currencyCode+'/per_day_all_time_history.csv');
    $('#volumes-link').attr('href', config.apiHistoryIndexUrl+currencyCode+'/volumes.csv');
};

var renderSmallChart = function(currencyCode){
    if (!apiDataUpdated) {
        return;
    }
    var global_avg_url = config.apiHistoryIndexUrl;
    var data_24h_URL = global_avg_url + currencyCode + '/per_minute_24h_global_average_sliding_window_short.csv';

    $.get(data_24h_URL, function(csv){
        var data = [];
        $.each(csv.split('\n'), function(i, line){
            var values = line.split(',');
            if(i == 0 || line.length == 0){
                return;
            }

            var chartDailyValue = parseFloat(values.slice(-1)[0]) / config.scaleDivizer;
            var dateStr = values[0];
            var dateData = dateStr.split(' ');
            dateData[0] = dateData[0].split('-');
            dateData[1] = dateData[1].split(':');
            var dateInt = Date.UTC(dateData[0][0], dateData[0][1] - 1, dateData[0][2], dateData[1][0], dateData[1][1], dateData[1][2]);
            data.push([dateInt, chartDailyValue]);
        });
        data.sort(function(a,b){
            if (a[0] > b[0]){
                return 1;
            } else if (a[0] < b[0]){
                return -1;
            } else {
                return -0;
            }
        });

        var priceShift = data[data.length - 1][1] - data[0][1];
        var priceShiftPercentage = priceShift / data[0][1] * 100;
        $('.main-price-shift .price-arrow').text(priceShift < 0 ? '▼' : '▲');
        $('.main-price-shift').attr('data-trend', priceShift < 0 ? 'down' : 'up');
        $('.main-price-shift .price-shift').text(priceShift).formatCurrency({
            symbol: getCurrencySymbol(currencyCode),
            positiveFormat: '%s%n ' + currencyCode,
            negativeFormat: '%s%n ' + currencyCode,
            roundToDecimalPlace: config.precision
        });
        $('.main-price-shift .price-shift-prc').text(Math.abs(priceShiftPercentage).toFixed(2) + '%');

        var prices = $.map(data, function (e, i) { return e[1]; });
        $('.main-price-highlow .price-high')
            .text(Math.max.apply(Math, prices))
            .formatCurrency({
                symbol: getCurrencySymbol(currencyCode),
                positiveFormat: '%s%n ' + currencyCode,
                roundToDecimalPlace: config.precision
        });
        $('.main-price-highlow .price-low')
            .text(Math.min.apply(Math, prices))
            .formatCurrency({
                symbol: getCurrencySymbol(currencyCode),
                positiveFormat: '%s%n ' + currencyCode,
                roundToDecimalPlace: config.precision
        });

        $('#small-chart').html('');

        $('#small-chart').highcharts('StockChart', {
            chart : {
                animation : {
                    duration: 10000
                },
                events: {
                    click: function(e){
                        window.location.href = 'charts.htm#'+currencyCode;
                    }
                },
                spacingBottom: 5,
                spacingLeft: 0,
                spacingRight: 0,
                spacingTop: 0
            },
            rangeSelector: {enabled: false},
            title: {text: '24h price '+currencyCode+' movement'},
            scrollbar: {enabled: false},
            navigator: {enabled: false},
            exporting: {enabled: false},
            tooltip: {
                enabled : true,
                valueDecimals: 3
            },
            credits: {enabled : false},
            series : [{
                name: currencyCode,
                data: data,
                cursor: 'pointer',
                events: {
                    click: function(event){
                        window.location.href = 'charts.htm#'+currencyCode;
                    }
                }
            }]

        });
    });
};

$(function(){
    $('#show-more-currencies-in-global-avg-table').click(function(e){
        e.preventDefault();
        if ($('.secondary-global-avg-row').is(':hidden')){
            $('.secondary-global-avg-row').removeClass('hidden');
            $.cookie("global-average-table", 'collapsed');
            $('#show-more-currencies-in-global-avg-table').text('less');
        } else {
            $('.secondary-global-avg-row').addClass('hidden');
            $.cookie("global-average-table", 'hidden');
            $('#show-more-currencies-in-global-avg-table').text('more');
        }
        return false;
    });

    $('#show-ignored').click(function(e){
        e.preventDefault();
        $('#legend-ignored-table').show();
        $(this).hide();
        return false;
    });

    callAPI();

    setInterval(callAPI, config.refreshRate);
    setInterval(renderUpdateTime, 5000);

    $('#legend-block').click(function(event){
        event.stopPropagation();
    });

    $('#currency-input').blur(function(){
        calc_renderFiat($(this).toNumber().val());
    });

    $('#currency-input').focus(function(){
        $('#currency-input').val($(this).toNumber().val());
    });
    $('#currency-input').keyup(calc_fiatInputKeyup);

    $('#bitcoin-input').blur(function(){
        calc_renderBitcoin($(this).toNumber().val(), $.cookie('base'));
    });
    $('#bitcoin-input').focus(function(){
        $('#bitcoin-input').val($(this).toNumber().val());
    });

    $('#bitcoin-input').keyup(calc_bitcoinInputKeyup);

    $('#global-last').on('dblclick', function () {
        // http://stackoverflow.com/questions/985272/jquery-selecting-text-in-an-element-akin-to-highlighting-with-your-mouse
        if (document.body.createTextRange) {
            var range = document.body.createTextRange();
            range.moveToElementText(this);
            range.select();
        } else if (window.getSelection) {
            var selection = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(this);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    });

    $('#base-switch-button').on('click', changeBaseButtonClick);

    // currency navigation (primary currency, secondary currency, currency tabs on markets page
    $(document).on('click', '.currency-navigation li', currencyNavigationClick );

    $(document).on('click', '.all-currency-navigation li', currencyNavigationClick );

    // hide calc currency list by esc
    $(document).keyup( function(e){
        if(e.which == 27){
            $('.calculator-currency-switch').slideUp();
        }
    } );


    // hide calc currency list by document click
    $(document).click(function(){
         $('.calculator-currency-switch').slideUp();
    });

    // hide or show calc currency list by calc currency label click
    $('#bitcoin-calc-currency-label').click(function(e){
        e.stopPropagation();
        if ($('.calculator-currency-switch').is(':visible')){
            $('.calculator-currency-switch').slideUp();
        } else {
            $('.calculator-currency-switch').slideDown();
        }
    });

    // collapsing or expanding extended currencies list
    $('.more-currencies').click(function(){
        var extendedCurrencyNavList = $('.all-currency-navigation');
        var moreCurrenciesBtn = $(this);
        if( extendedCurrencyNavList.is(':visible')) {
            extendedCurrencyNavList.slideUp( "slow", function() {
                moreCurrenciesBtn.text('more currencies');
            });
        } else {
            extendedCurrencyNavList.slideDown( "slow", function() {
                moreCurrenciesBtn.text('less currencies');
            });
        }
        return false;
    });
    renderMajorCurrencies();
    renderSecondaryCurrencies();
    renderWorldCurrencies();

    if (config.apiUsers.length > 0) {
        $('.ba-ads-left').append('<p>BAPI used by</p>');
        $.each(config.apiUsers, function (i, entry) {
            var banner = $('<div/>', {class: 'usedby'});
            banner.append($('<img/>', {
                src: entry.image,
                alt: entry.name,
            }));
            banner.append($('<a/>', {
                href: entry.href,
                title: entry.name,
                target: "_blank",
            }).html(entry.name));
            $('.ba-ads-left').append(banner);
        });
    }
});
