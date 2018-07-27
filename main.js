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
                            
                            var valValue = content.result.items[i].tagValues[j].value;
                            var valTag = content.result.items[i].tagValues[j].tagName;
                            var valType = typeof valValue;
                            
                            switch (valType) {
                                case "boolean":
                                    var valRole = 'indicator.working';
                                    break;
                                
                                case "number":
                                    if (valTag.search('Date') > -1){
                                        var valRole = 'value.datetime';
                                        break;
                                    }
                                    if (valTag.search('StateOfCharge') == 0){
                                        var valRole = 'value.battery';
                                        break;
                                    }
                                    if (valTag.search('PowerConsum') == 0 || valTag.search('Work') == 0){
                                        var valRole = 'value.power.consumption';
                                        break;
                                    }
                                    if (valTag.search('Temperature') == 0){
                                        var valRole = 'value.temperature';
                                        break;
                                    }
                                    if (valTag.search('Min') > -1 && valTag.search('Minute') == -1){
                                        var valRole = 'value.min';
                                        break;
                                    }
                                    if (valTag.search('Max') > -1){
                                        var valRole = 'value.max';
                                        break;
                                    }
                                    var valRole = 'value';
                                    break;
                                
                                case "string":
                                    var valRole = 'text';
                                    break;

                                default:
                                    var valRole = 'state';
                                    break;
                            }

                            if (valValue != null && valType != 'object') {

                                adapter.setObjectNotExists(
                                    content.result.items[i].guid + "." + valTag, {
                                        type: 'state',
                                        common: {
                                            name: valTag,
                                            type: valType,
                                            role: valRole
                                        },
                                        native: {}
                                    },
                                    adapter.setState(
                                        content.result.items[i].guid + "." + valTag,
                                        {val: valValue, ack: true}
                                    )
                                );

                            }
                            
                        }
                    }
                    adapter.stop();

                } else {
                    adapter.log.error(error);
                    adapter.stop();
                }
            }

        )
    } else if (managerType == "solarwatt") {
        adapter.log.info("Solarwatt doesn't work at the moment.");
        adapter.stop();
    }

}
