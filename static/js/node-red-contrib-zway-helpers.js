function zway_gatewayScanner(nodeItem, selectedItemElementName, options = {}) {
    $.getJSON('zway/gwscanner', {})
        .done(function (data, textStatus, jqXHR) {
            console.log(data);
        }).fail(function (jqXHR, textStatus, errorThrown) {});
}

function zway_getItemList(nodeItem, selectedItemElementName, options = {}) {
    
    options = $.extend({
        filterType:'',
        disableReadonly:false,
        refresh:false,
        allowEmpty:false,
        deviceType:false,
        batteryFilter:false,
    }, options);

    function zway_updateItemList(controller, selectedItemElement, itemName, refresh = false) {
        // Remove all previous and/or static (if any) elements from 'select' input element
        selectedItemElement.children().remove();
        if (controller) {
            $.getJSON('zway/itemlist', {
                controllerID: controller.id,
                forceRefresh: refresh
            })
                .done(function (data, textStatus, jqXHR) {
                    try {
                        // if (options.allowEmpty) {
                            // selectedItemElement.html('<option value="" disabled selected>Select device</option>');
                        // }

                        var disabled = '';
                        var nameSuffix = '';
                        // var selected = false;
                        var prevName = '';

                        var itemList = [];
                        
                        $.each(data.items, function(index, value) {
                            itemList.push(value)
                        });
                        var itemsByName = itemList.slice(0);

                        itemsByName.sort(function(a,b) {
                            var x = a.device_name.toLowerCase();
                            var y = b.device_name.toLowerCase();
                            return x < y ? -1 : x > y ? 1 : 0;
                        });

                        $.each(itemsByName, function(index, value) {
                            disabled = '';
                            nameSuffix = '';

                            // if (options.deviceType && options.deviceType != value.meta.device_type) {
                            //     return true;
                            // }

                            // if (options.batteryFilter &&
                            //     (!("meta" in value)
                            //     || !("config" in value.meta)
                            //     // || !("battery" in value.meta.config)
                            //     )
                            // ) {

                            //     return true;
                            // }

                            var parentElement = selectedItemElement;
                            console.log(value);
                            $('<option'+ disabled+' value="' + value.uniqueid +'">&#9679;&nbsp;' + value.meta.metrics.title + (nameSuffix?' ('+nameSuffix+')':'') +'</option>').appendTo(parentElement);
                        });

                        // Enable item selection
                        selectedItemElement.multiselect('enable');
                        // Finally, set the value of the input select to the selected value
                        selectedItemElement.val(itemName);
                        // // Rebuild bootstrap multiselect form
                        selectedItemElement.multiselect('rebuild');
                        // // Trim selected item string length with elipsis
                        var selectItemSpanElement = $(`span.multiselect-selected-text:contains("${itemName}")`);
                        var sHTML = selectItemSpanElement.html();
                        selectItemSpanElement.html(zway_truncateWithEllipses(sHTML, 35));
                    } catch (error) {
                        console.error('Error #4534');
                        console.log(error);
                    }
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    // Disable item selection if no items were retrieved
                    selectedItemElement.multiselect('disable');
                    selectedItemElement.multiselect('refresh');
                    //console.error(`Error: ${errorThrown}`);
                });

        } else {
            // Disable item selection if no (valid) controller was selected
            selectedItemElement.multiselect('disable');
            selectedItemElement.multiselect('refresh');
        }
    }


    var deServerElement = $('#node-input-server');
    var refreshListElement = $('#force-refresh');
    var selectedItemElement = $(selectedItemElementName);


    // Initialize bootstrap multiselect form
    selectedItemElement.multiselect({
        enableFiltering: true,
        enableCaseInsensitiveFiltering: true,
        filterPlaceholder: RED._("node-red-contrib-zway/in:multiselect.filter_devices"),
        includeResetOption: true,
        includeResetDivider: true,
        resetText: RED._("node-red-contrib-zway/in:multiselect.refresh"),
        numberDisplayed: 1,
        maxHeight: 300,
        disableIfEmpty: true,
        nSelectedText: 'selected',
        nonSelectedText: RED._("node-red-contrib-zway/in:multiselect.none_selected"),
        buttonWidth: '70%',
    });

    // Initial call to populate item list
    zway_updateItemList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, false);
    // onChange event handler in case a new controller gets selected
    deServerElement.change(function (event) {
        zway_updateItemList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, true);
    });
    refreshListElement.click(function (event) {
        // Force a refresh of the item list
        zway_updateItemList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, true);
    });
}


function zway_getItemStateList(nodeItem, selectedItemElementName, options = {}) {

    options = $.extend({
        filterType:'',
        disableReadonly:false,
        refresh:false
    }, options);

    function zway_updateItemStateList(controller, selectedItemElement, itemName) {
        // Remove all previous and/or static (if any) elements from 'select' input element
        selectedItemElement.children().remove();

        var uniqueId = $('#node-input-device').val();
        if (controller && uniqueId) {
            $.getJSON('deconz/statelist', {
                controllerID: controller.id,
                uniqueid:uniqueId
            })
                .done(function (data, textStatus, jqXHR) {
                    try {

                        selectedItemElement.html('<option value="0">'+ RED._("node-red-contrib-deconz/in:multiselect.complete_payload")+'</option>');


                        $.each(data, function(index, value) {
                            // $('<option  value="' + index +'">'+index+'</option>').appendTo(selectedItemElement);
                            $('<option  value="' + index +'">'+index+' ('+value+')</option>').appendTo(selectedItemElement);
                        });

                        // Enable item selection
                        selectedItemElement.multiselect('enable');
                        // Finally, set the value of the input select to the selected value
                        selectedItemElement.val(itemName);
                        // Rebuild bootstrap multiselect form
                        selectedItemElement.multiselect('rebuild');
                        // Trim selected item string length with elipsis
                        var selectItemSpanElement = $(`span.multiselect-selected-text:contains("${itemName}")`);
                        var sHTML = selectItemSpanElement.html();
                        selectItemSpanElement.html(zway_truncateWithEllipses(sHTML, 35));

                    } catch (error) {
                        console.error('Error #4534');
                        console.log(error);
                    }

                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    // Disable item selection if no items were retrieved
                    selectedItemElement.multiselect('disable');
                    selectedItemElement.multiselect('refresh');
                    //console.error(`Error: ${errorThrown}`);
                });

        } else {
            // Disable item selection if no (valid) controller was selected
            selectedItemElement.multiselect('disable');
            selectedItemElement.multiselect('refresh');
        }
    }


    var deServerElement = $('#node-input-server');
    var selectedItemElement = $(selectedItemElementName);




    // Initialize bootstrap multiselect form
    selectedItemElement.multiselect({
        numberDisplayed: 1,
        maxHeight: 300,
        disableIfEmpty: true,
        nSelectedText: 'selected',
        nonSelectedText: RED._("node-red-contrib-deconz/in:multiselect.complete_payload"),
        buttonWidth: '70%',
    });


    // Initial call to populate item list
    zway_updateItemStateList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem);

    // onChange event handler in case a new controller gets selected
    deServerElement.change(function (event) {
        zway_updateItemStateList(RED.nodes.node(deServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem);
    });
}


/**
 * truncateWithEllipses
 *
 * Utility function to truncate long strings with elipsis ('...')
 *
 */
function zway_truncateWithEllipses(text, max = 30) {
    if (text) {
        return text.substr(0, max - 1) + (text.length > max ? '&hellip;' : '');
    } else {
        return text;
    }
}

function zway_filterDeviceName(name) {
    var result =  name.replace(/ *\([^)]*\) */g, ""); //remove (lights: 1)
    result = result.replace(new RegExp('●', 'g'), '');
    result = result.trim();
    return result;

}