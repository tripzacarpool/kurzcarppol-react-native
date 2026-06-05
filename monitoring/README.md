# Raaheasy Monitoring And Load Tests

This folder keeps the production monitoring setup repeatable.

## Grafana

Grafana is served through the API host at:

```text
https://api.raaheasy.app/grafana/
```

Prometheus scrapes the API metrics endpoint, host metrics, Redis, and Redpanda. The API exposes Prometheus metrics at `/metrics`.

## k6

Run the smoke test from the monitoring EC2 node:

```bash
sudo docker run --rm --net=host -i \
  -v /home/ec2-user/load-tests:/scripts \
  grafana/k6:0.54.0 run \
  -e K6_PROMETHEUS_RW_SERVER_URL=http://127.0.0.1:9090/api/v1/write \
  -o experimental-prometheus-rw \
  /scripts/raaheasy-smoke.js
```

Run the peak template carefully:

```bash
sudo docker run --rm --net=host -i \
  -v /home/ec2-user/load-tests:/scripts \
  grafana/k6:0.54.0 run \
  -e PEAK_VUS=25 \
  -e K6_PROMETHEUS_RW_SERVER_URL=http://127.0.0.1:9090/api/v1/write \
  -o experimental-prometheus-rw \
  /scripts/raaheasy-peak-template.js
```

Use the peak template against production only when you are watching Grafana and ready to stop the test.
