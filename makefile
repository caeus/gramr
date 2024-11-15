

install:
	npm install

lint: install
	npm run lint

format: install
	npm run format

docs: install lint
	npm run docs

build: install lint
	npm run build

publish: build docs
	npm publish
 