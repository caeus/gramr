

install:
	npm install

lint: install
	npm run lint

format: install
	npm run format

docs: install lint
	rm -rf docs && npm run docs

build: clean install lint test docs
	npm run build

test: lint
	npx vitest run

clean:
	rm -rf dist

publish: test docs build
	npm publish
 