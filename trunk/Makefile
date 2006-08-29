pack:
	./build.sh

clean:
	rm -f nostalgy.jar nostalgy.xpi *~
	(cd content; rm *~)


install:
	scp CHANGES clipper.ens.fr:www/info/CHANGES_NOSTALGY
	scp content/about.xhtml clipper.ens.fr:www/info/ABOUT_NOSTALGY.html
	scp nostalgy.xpi clipper.ens.fr:www/nostalgy-current.xpi