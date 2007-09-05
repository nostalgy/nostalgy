pack:
	./build.sh

clean:
	rm -f nostalgy.jar nostalgy.xpi *~
	(cd content; rm -f *~)


install:
	scp CHANGES frisch.fr:www/info/CHANGES_NOSTALGY
	scp content/about.xhtml frisch.fr:www/info/ABOUT_NOSTALGY.html
	scp nostalgy.xpi frisch.fr:www/info/nostalgy-current.xpi
