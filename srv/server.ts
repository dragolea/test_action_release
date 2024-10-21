// HACK: temporary hack to enable local frontend development together with deployment to BTP -> move this in a CAP plugin.
// This is due to a mismatch of the manifest.json odata path (relative/absolute).
// A working deployment needs a relative path for odata service in manifest.json
// which interferes with the TypeScript frontend development based on the CAP cds-plugin-ui5.
// This plugin injects the app path in the service url which leads to a 404 in loading metadata.

// TODO:
// - change to cap plugin
// - get all services paths dynamically (e.g. service ServiceAccruals @(path: '/accruals'))
// - get all apps
// - replace the url string dynamically for all app/service combinations
// - The cds-plugin-ui5 removes automatically the webapp folder but can be configured in cds package.json part like
/* - modules are the related frontend UI5 apps in ./app folder
  "cds": {  
    "cds-plugin-ui5": {
      "modules": {
        "fcoaccruals": {
          "mountPath": "/fcoaccruals"
        }
      }
    }
  }
*/
import cds from '@sap/cds';

cds.on('bootstrap', (app) => {
  app.use(function (req, res, next) {
    req.url = req.url.replace('/fcoaccruals/accruals/', '/accruals/');
    req.url = req.url.replace('/fcoaccruals.costcenter/accruals/', '/accruals/');
    res.setHeader('Rewrite-Path', req.url);
    next();
  });
});

export default cds.server;
