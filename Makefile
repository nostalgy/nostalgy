pack:
	./build.sh
	sort files > files.sorted
	mv files.sorted files

clean:
	rm -f nostalgy.jar nostalgy.xpi *~
	(cd content; rm -f *~)


install:
	scp CHANGES frisch@frisch.fr:www/info/CHANGES_NOSTALGY
	scp content/about.xhtml frisch@frisch.fr:www/info/ABOUT_NOSTALGY.html
	scp nostalgy.xpi frisch@frisch.fr:www/info/nostalgy-current.xpi
