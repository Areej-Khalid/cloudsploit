var async = require('async');
var helpers = require('../../../helpers/google');

module.exports = {
    title: 'COS Image Enabled',
    category: 'Kubernetes',
    domain: 'Containers',
    description: 'Ensures all Kubernetes cluster nodes have Container-Optimized OS enabled',
    more_info: 'Container-Optimized OS is optimized to enhance node security. It is backed by a team at Google that can quickly patch it.',
    link: 'https://cloud.google.com/container-optimized-os/',
    recommended_action: 'Enable Container-Optimized OS on all Kubernetes cluster nodes',
    apis: ['clusters:list', 'projects:get'],

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var regions = helpers.regions();

        let projects = helpers.addSource(cache, source,
            ['projects','get', 'global']);

        if (!projects || projects.err || !projects.data || !projects.data.length) {
            helpers.addResult(results, 3,
                'Unable to query for projects: ' + helpers.addError(projects), 'global', null, null, (projects) ? projects.err : null);
            return callback(null, results, source);
        }

        var project = projects.data[0].name;

        async.each(regions.clusters, function(region, rcb){
            let clusters = helpers.addSource(cache, source,
                ['clusters', 'list', region]);

            if (!clusters) return rcb();

            if (clusters.err || !clusters.data) {
                helpers.addResult(results, 3, 'Unable to query Kubernetes clusters', region, null, null, clusters.err);
                return rcb();
            }

            if (!clusters.data.length) {
                helpers.addResult(results, 0, 'No Kubernetes clusters found', region);
                return rcb();
            }

            clusters.data.forEach(cluster => {
                let location;
                if (cluster.locations) {
                    location = cluster.locations.length === 1 ? cluster.locations[0] : cluster.locations[0].substring(0, cluster.locations[0].length - 2);
                } else location = region;

                let resource = helpers.createResourceName('clusters', cluster.name, project, 'location', location);

                let found = false;
                let nonCosNodes = [];
                if (cluster.nodePools &&
                    cluster.nodePools.length) {
                    found = true;
                    cluster.nodePools.forEach(nodePool => {
                        if (!nodePool.config || !nodePool.config.imageType || !nodePool.config.imageType === "COS") nonCosNodes.push(nodePool.name); 
                    })
                }

                if (nonCosNodes.length) {
                    helpers.addResult(results, 2,
                        `Container-Optimized OS disabled for these node pools: ${cluster.name}`, region, resource);
                } else {
                    helpers.addResult(results, 0,
                        'Container-Optimized OS is enabled for all node pools', region, resource);
                }
                
                if (!found) {
                    helpers.addResult(results, 0, 'No node pools found', region, resource);
                }
            });

            rcb();
        }, function(){
            // Global checking goes here
            callback(null, results, source);
        });
    }
}