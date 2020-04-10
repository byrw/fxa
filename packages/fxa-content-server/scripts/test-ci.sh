#!/bin/bash -ex

DIR=$(dirname "$0")

# copied from /test/curl.sh
function check() {
  # Real startup of the servers takes longer than `pm start`.
  # In order to check their urls, we have to wait for them (2 minutes) and periodically
  # check if their endpoints are available.
  # Function takes following parameters:
  # * $1 - an url of an endpoint to check
  # * $2 [optional] - expected status code of a response from this endpoint. Defaults to 200.
  RETRY=12
  for i in $(eval echo "{1..$RETRY}"); do
    if [ "$(curl -s -o /dev/null --silent -w "%{http_code}"  http://$1)" == "${2:-200}" ]; then
      return
    else
      if [ "$i" -lt $RETRY ]; then
        sleep 10
      fi
    fi
  done

  exit 1
}

function test_suite() {
  local suite=$1
  local numGroups=6

  for i in $(seq $numGroups)
  do
    node tests/intern.js --suites="${suite}" --groupsCount=${numGroups} --groupNum="${i}" --firefoxBinary=./firefox/firefox || \
    node tests/intern.js --suites="${suite}" --groupsCount=${numGroups} --groupNum="${i}" --firefoxBinary=./firefox/firefox --grep="$(<rerun.txt)"
  done
}

cd "$DIR/.."

mkdir -p config
cp ../version.json ./
cp ../version.json config

npm run lint

cd ../../
npx pm2 start .circleci/pm2.json

cd packages/fxa-content-server
mozinstall /firefox.tar.bz2

# ensure email-service is ready
check 127.0.0.1:8001/__heartbeat__
# ensure payments-server is ready
check 127.0.0.1:3031/__lbheartbeat__
test_suite circle

# node 5 currently has the least work to do in the above tests
if [[ "${CIRCLE_NODE_INDEX}" == "5" ]]; then
  test_suite server

  mozinstall /7f10c7614e9fa46-target.tar.bz2
  test_suite pairing
fi
