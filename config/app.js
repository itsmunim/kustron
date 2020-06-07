const app = {
  // basics
  name: {
    required: true,
    help: `Name of your application.`,
  },
  namespace: {
    required: false,
    help: `Namespace helps to isolate kubernetes resources for your application;
    if not given, name will be used as default.`,
  },
  port: {
    required: true,
    help: `The port where the app will be served. e.g. 8080`,
  },
  healthcheck: {
    required: false,
    help: `The healthcheck path. Needed to define readiness probe- it should just return 200
      when hit. e.g. '/health'. Readiness probe helps ingress to know when your service is
      ready to serve. Recommended.`,
  },
  exposed: {
    required: false,
    default: false,
    help: `Denotes if the app should be exposed publicly. Based on this a proper service setup
    will be done and ingress will be defined. Default is 'false'.`,
  },
  allowhttp: {
    required: false,
    default: true,
    help: `If exposed is true, then this one defines if http is allowed or only https is.
    Default is 'true'.`,
  },
  // autoscaling config
  enableautoscale: {
    required: false,
    default: false,
    help: `Should enable autoscaling of pods or not. If set, then 'minreplicas' and 'maxreplicas'
    should be provided. Default is 'false'.`,
  },
  minreplicas: {
    required: false,
    default: 2,
    help: `Minimum number of service pods. Default is '2'.`,
  },
  maxreplicas: {
    required: false,
    default: 20,
    help: `Max number of service pods. Default is '20'.`,
  },
  cputhreshold: {
    required: false,
    default: 75,
    help: `Helps HPA to decide when to increase number of pods based on cpu usage of each pod.
    Default is '75' which denotes 75% usage.`,
  },
  memthreshold: {
    required: false,
    default: 70,
    help: `Helps HPA to decide when to increase number of pods based on memory usage of each pod.
    Default is '70' which denotes 70% usage.`,
  },
  // resource limit
  cpulimit: {
    required: true,
    help: `The highest cpu limit for each pod. Translated into 'limits.cpu'.
        Ref- kubernetes.io/docs/concepts/configuration/manage-resources-containers`,
  },
  initialcpu: {
    required: true,
    help: `The initial cpu amount for each pod. Translated into 'requests.cpu'.
        Ref- kubernetes.io/docs/concepts/configuration/manage-resources-containers`,
  },
  memorylimit: {
    required: true,
    help: `The highest memory limit for each pod. Translated into 'limits.memory'.
        Ref- kubernetes.io/docs/concepts/configuration/manage-resources-containers`,
  },
  initialmemory: {
    required: true,
    help: `The initial memory amount for each pod. Translated into 'requests.memory'.
        Ref- kubernetes.io/docs/concepts/configuration/manage-resources-containers`,
  },
};

export default app;
