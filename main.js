/**
 *
 * energymanager adapter
 *
 */

'use strict';

const utils =    require(__dirname + '/lib/utils');
var request = require('request');

const adapter = new utils.Adapter('energymanager');

adapter.on('ready', function () {
    main();
});

function main() {

    var managerType = adapter.config.managerType
    var managerAddress = adapter.config.managerAddress

    if (managerType == "eon") {
        request(
            {
                url: "http://" + managerAddress + "/rest/kiwigrid/wizard/devices",
                json: true
            },
            function(error, response, content) {

                if (!error && response.statusCode == 200) {
                    
                    for (var i in content.result.items) {

                        for (var j in content.result.items[i].tagValues) {
                            
                            if (content.result.items[i].tagValues[j].value != null && content.result.items[i].tagValues[j].value != "[object Object]") {

                                adapter.setObjectNotExists(content.result.items[i].guid + "." + content.result.items[i].tagValues[j].tagName, {
                                    type: 'state',
                                    common: {
                                        name: content.result.items[i].tagValues[j].tagName,
                                        type: typeof content.result.items[i].tagValues[j].value,
                                        role: 'value'
                                    },
                                    native: {}
                                });
                            
                                adapter.setState(content.result.items[i].guid + "." + content.result.items[i].tagValues[j].tagName, {val: content.result.items[i].tagValues[j].value, ack: true});

                            }
                            
                        }
                    }
                    
                    

                } else {
                    adapter.log.error(error);
                }
            }

        )
    } else if (managerType == "solarwatt") {
        adapter.log.info("Solarwatt doesn't work at the moment.");
    }

    setTimeout(function() {
        adapter.stop();
    }, 10000);

}
