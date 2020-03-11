#!/bin/sh
NOT='.sh$|^.git|.jsx$|^tests|^.eslint|^.travis|^package.json$|^package-lock.json$'
cwd=$(pwd)
DIST=$(mktemp -d)
# FIXME: get name and version from manifest.json
VERSION=$(grep '"version"' manifest.json | sed 's/.\+: "\([^"]\+\)",/\1/')
ADDON="nostalgy68-${VERSION}.xpi"

echo $DIST
cp LICENSE README.md chrome.manifest manifest.json CHANGES.txt  $DIST/

for a in $(git ls-files chrome | egrep -v $NOT); do
  mkdir -p $(dirname "${DIST}/${a}")
  cp $a $DIST/$a
done

for a in $(git ls-files components | egrep -v $NOT); do
  mkdir -p $(dirname "${DIST}/${a}")
  cp $a $DIST/$a
done

rm -f ${ADDON}
cd $DIST
zip -r $cwd/${ADDON} *
cd $cwd
md5sum ${ADDON} > ${ADDON}.md5

