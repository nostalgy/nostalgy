all: clean nostalgy.xpi

nostalgy.xpi:
	./build.sh

clean:
	$(RM) nostalgy.xpi

install:
	scp CHANGES frisch@frisch.fr:www/info/CHANGES_NOSTALGY
	scp content/about.xhtml frisch@frisch.fr:www/info/ABOUT_NOSTALGY.html
	scp nostalgy.xpi frisch@frisch.fr:www/info/nostalgy-current.xpi
