#!/bin/sh
NOT='.sh$|^.git|.jsx$|^tests|^.eslint|^.travis|^package.json$|^package-lock.json$'
cwd=$(pwd)
DIST=$(mktemp -d)
# FIXME: get name and version from manifest.json
ADDON=nostalgy68-68_1

echo $DIST
cp LICENSE README.md chrome.manifest manifest.json CHANGES  $DIST/

for a in $(git ls-files chrome | egrep -v $NOT); do
  mkdir -p $(dirname "${DIST}/${a}")
  cp $a $DIST/$a
done

for a in $(git ls-files components | egrep -v $NOT); do
  mkdir -p $(dirname "${DIST}/${a}")
  cp $a $DIST/$a
done

rm -f ${ADDON}.xpi
cd $DIST
zip -r $cwd/${ADDON}.xpi *
cd $cwd

