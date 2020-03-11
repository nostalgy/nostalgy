VERSION:=$(shell grep '"version"' manifest.json | sed 's/.\+: "\([^"]\+\)",/\1/')
ADDON="nostalgy68-$(VERSION).xpi"

all: clean 
	./build.sh

clean:
	$(RM) $(ADDON) $(ADDON).md5

install:
	scp CHANGES frisch@frisch.fr:www/info/CHANGES_NOSTALGY
	scp content/about.xhtml frisch@frisch.fr:www/info/ABOUT_NOSTALGY.html
	scp nostalgy.xpi frisch@frisch.fr:www/info/nostalgy-current.xpi
