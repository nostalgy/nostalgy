pack:
	./build.sh

clean:
	rm -f nostalgy.jar nostalgy.xpi *~
	(cd content; rm *~)


install:
	scp CHANGES clipper.ens.fr:www/info/CHANGES_NOSTALGY