const jsyaml = require('js-yaml');
const path = require('path');
const fs = require('fs');

const deployment = fs.readFileSync(
  path.resolve('.k8s/deployment.yaml'),
  'utf-8'
);

const deplJson = jsyaml.load(deployment);

const secrets; // fetch from SM
/*
{
  namespace: {
    KEY_1: value
    KEY_2: value
  }

}
*/

const envVars = [];
Object.keys(secrets[deplJson.metadata.namespace]).forEach((key) => {
  const envVar = {
    name: key,
    valueFrom: {
      secretKeyRef: {
        name: 'ava-secrets',
        value: secrets[key],
      },
    },
  };

  envVars.push(envVar);
});

deplJson.spec.template.spect.containers.forEach((container) => {
  container.env = envVars;
});

fs.writeFileSync(path.resolve('.k8s/deployment.yaml'), jsyaml.dump(deplJson));

