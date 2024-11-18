

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

test:
	npx vitest run

publish: test docs build
	npm publish
 