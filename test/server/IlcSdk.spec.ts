import IlcSdk from '../../src/server/index';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Request as MockReq, Response as MockRes } from 'mock-http';
import merge from 'lodash.merge';

import defaultIntlAdapter from '../../src/app/defaultIntlAdapter';
import fakeCons from '../utils/console';
import { intlSchema } from '../../src/server/IlcProtocol';

const defReq = Object.freeze({
    url: '/tst',
    headers: { host: 'example.com', 'x-request-host': 'example.com', 'x-request-uri': '/tst' },
});

describe('IlcSdk', () => {
    let ilcSdk: IlcSdk;
    let stubCons: sinon.SinonStubbedInstance<Console>;

    beforeEach(() => {
        stubCons = sinon.stub(fakeCons);
        ilcSdk = new IlcSdk({ logger: fakeCons });
    });

    afterEach(() => {
        (sinon as any).restoreObject(fakeCons);
    });

    describe('constructor options', () => {
        it('should correctly set default options', () => {
            const ilcSdk = new IlcSdk();
            expect((ilcSdk as any).log).equal(console);
            expect((ilcSdk as any).defaultPublicPath).equal('/');
        });
    });

    describe('processRequest', () => {
        describe('getCurrentReqHost', () => {
            it('should parse request host correctly', () => {
                const req = new MockReq(merge({}, defReq));
                const res = ilcSdk.processRequest(req);

                expect(res.getCurrentReqHost()).to.eq(defReq.headers['x-request-host']);
            });

            it('should fallback to dumb request host if not passed', () => {
                const reqConf = merge({}, defReq);
                delete reqConf.headers['x-request-host'];
                const req = new MockReq(reqConf);
                const res = ilcSdk.processRequest(req);

                expect(res.getCurrentReqHost()).to.eq('localhost');
                sinon.assert.calledWith(
                    stubCons.warn,
                    'Missing "x-request-host" information for "http://example.com/tst" request. Falling back to "localhost".',
                );
            });
        });

        describe('getCurrentReqOriginalUri', () => {
            it('should parse x-request-uri correctly', () => {
                const req = new MockReq(merge({}, defReq));
                const res = ilcSdk.processRequest(req);

                expect(res.getCurrentReqOriginalUri()).to.eq(defReq.headers['x-request-uri']);
            });

            it('should fallback to dumb request URI if not passed', () => {
                const reqConf = merge({}, defReq);
                delete reqConf.headers['x-request-uri'];
                const req = new MockReq(reqConf);
                const res = ilcSdk.processRequest(req);

                expect(res.getCurrentReqOriginalUri()).to.eq('/');
                sinon.assert.calledWith(
                    stubCons.warn,
                    'Missing "x-request-uri" information for "http://example.com/tst" request. Falling back to "/".',
                );
            });
        });

        describe('appId', () => {
            it('should parse appId correctly', () => {
                const routerProps = JSON.stringify({
                    basePath: '/base/path/',
                    reqUrl: '/base/path/a/b/c?a=1&b=a',
                    fragmentName: 'testId',
                });
                const req = new MockReq(
                    merge({}, defReq, {
                        url: `/tst?routerProps=${Buffer.from(routerProps, 'utf8').toString('base64')}`,
                    }),
                );
                const res = ilcSdk.processRequest(req);

                expect(res.appId).to.eq('testId');
                sinon.assert.notCalled(stubCons.warn);
            });

            it('should fallback to dumb appId if not passed', () => {
                const req = new MockReq(merge({}, defReq));
                const res = ilcSdk.processRequest(req);

                expect(res.appId).to.eq('dumbId');
                sinon.assert.calledTwice(stubCons.warn);
                sinon.assert.calledWith(
                    stubCons.warn,
                    'Missing "appId" information for "http://example.com/tst" request. Falling back to dumb ID.',
                );
            });
        });

        it('should not fail on regular request', () => {
            const req = new MockReq(merge({}, defReq));
            const res = ilcSdk.processRequest(req);

            expect(res.getCurrentPathProps()).to.eql({});
            expect(res.getCurrentBasePath()).to.eq('/');
            expect(res.getCurrentReqUrl()).to.eq('/');
            sinon.assert.calledWith(
                stubCons.warn,
                'Missing "routerProps" for "http://example.com/tst" request. Fallback to / & /',
            );
        });

        describe('should correctly determine base path', () => {
            it('with trailing slash', () => {
                const routerProps = JSON.stringify({
                    basePath: '/base/path/',
                    reqUrl: '/base/path/a/b/c?a=1&b=a',
                    fragmentName: 'testId',
                });
                const req = new MockReq(
                    merge({}, defReq, {
                        url: `/tst?routerProps=${Buffer.from(routerProps, 'utf8').toString('base64')}`,
                    }),
                );
                const res = ilcSdk.processRequest(req);

                expect(res.getCurrentBasePath()).to.eq('/base/path/');
                expect(res.getCurrentReqUrl()).to.eq('/a/b/c?a=1&b=a');
                sinon.assert.notCalled(stubCons.warn);
            });

            it('without trailing slash', () => {
                const routerProps = JSON.stringify({
                    basePath: '/base/path',
                    reqUrl: '/base/path/a/b/c?a=1&b=a',
                    fragmentName: 'testId',
                });
                const req = new MockReq(
                    merge({}, defReq, {
                        url: `/tst?routerProps=${Buffer.from(routerProps, 'utf8').toString('base64')}`,
                    }),
                );
                const res = ilcSdk.processRequest(req);

                expect(res.getCurrentBasePath()).to.eq('/base/path');
                expect(res.getCurrentReqUrl()).to.eq('/a/b/c?a=1&b=a');
                sinon.assert.notCalled(stubCons.warn);
            });
        });

        describe('should parse app props', () => {
            it('should parse props', () => {
                const appProps = JSON.stringify({
                    a: 'b',
                    c: { d: 'e' },
                });
                const req = new MockReq(
                    merge({}, defReq, {
                        url: `/tst?appProps=${Buffer.from(appProps, 'utf8').toString('base64')}`,
                    }),
                );
                const res = ilcSdk.processRequest(req);

                expect(res.getCurrentPathProps()).to.eql(JSON.parse(appProps));
            });

            it('should fallback in case of malformed props', () => {
                const req = new MockReq(
                    merge({}, defReq, {
                        url: `/tst?appProps=bad_props`,
                    }),
                );
                const res = ilcSdk.processRequest(req);

                expect(res.getCurrentPathProps()).to.eql({});
            });
        });

        describe('should parse intl info', () => {
            it('should parse intl info correctly', () => {
                const data = {
                    current: { locale: 'en-GB', currency: 'EUR' },
                    default: { locale: 'en-US', currency: 'USD' },
                    supported: { locale: ['en-US', 'en-GB'], currency: ['USD', 'EUR'] },
                    routingStrategy: 'prefix',
                };
                const req = new MockReq(
                    merge({}, defReq, {
                        headers: { 'x-request-intl': intlSchema.toBuffer(data).toString('base64') },
                    }),
                );
                const res = ilcSdk.processRequest(req);

                expect(res.intl.get()).to.deep.include(data.current);
                expect(res.intl.config.default).to.deep.include(data.default);
                expect(res.intl.config.supported).to.deep.include(data.supported);
                expect(res.intl.config.routingStrategy).to.eql(data.routingStrategy);
            });

            it('should ignore invalid intl info', () => {
                const req = new MockReq(
                    merge({}, defReq, {
                        headers: { 'x-request-intl': 'some random string' },
                    }),
                );
                const res = ilcSdk.processRequest(req);
                expect(res.intl).to.eq(defaultIntlAdapter);

                const req2 = new MockReq(
                    merge({}, defReq, {
                        headers: { 'x-request-intl': 'en-GB:en-US:en-US,en-GB;some random string' },
                    }),
                );
                const res2 = ilcSdk.processRequest(req2);
                expect(res2.intl.config).to.eql(defaultIntlAdapter.config);
                expect(res2.intl.get()).to.eql(defaultIntlAdapter.get());
            });

            it("should not fail & return default intl adapter if ILC haven't passed anything", () => {
                const req = new MockReq(merge({}, defReq));
                const res = ilcSdk.processRequest(req);

                expect(res.intl).to.eq(defaultIntlAdapter);
            });
        });
    });

    describe('processResponse', () => {
        it('should not fail on regular request', () => {
            const req = new MockReq(merge({}, defReq));
            const res = new MockRes();

            const pRes = ilcSdk.processRequest(req);
            ilcSdk.processResponse(pRes, res);
        });

        it('should set page title', () => {
            const req = new MockReq(merge({}, defReq));
            const res = new MockRes();

            const pRes = ilcSdk.processRequest(req);
            ilcSdk.processResponse(pRes, res, { pageTitle: 'Test title' });
            expect(res.getHeader('x-head-title')).to.eq(
                Buffer.from('<title>Test title</title>', 'utf8').toString('base64'),
            );
        });

        it('should set page title formatted as HTML', () => {
            const req = new MockReq(merge({}, defReq));
            const res = new MockRes();

            const pRes = ilcSdk.processRequest(req);
            ilcSdk.processResponse(pRes, res, { pageTitle: '<title>Test title</title>' });
            expect(Buffer.from(res.getHeader('x-head-title') as string, 'base64').toString('utf8')).to.eq(
                '<title>Test title</title>',
            );
        });

        it('should set page title formatted as HTML with attrs', () => {
            const req = new MockReq(merge({}, defReq));
            const res = new MockRes();

            const pRes = ilcSdk.processRequest(req);
            ilcSdk.processResponse(pRes, res, { pageTitle: '<title data-react-helmet="true">Test title</title>' });
            expect(Buffer.from(res.getHeader('x-head-title') as string, 'base64').toString('utf8')).to.eq(
                '<title data-react-helmet="true">Test title</title>',
            );
        });

        it('should set page meta tags', () => {
            const req = new MockReq(merge({}, defReq));
            const res = new MockRes();

            const pRes = ilcSdk.processRequest(req);
            ilcSdk.processResponse(pRes, res, { pageMetaTags: '<meta charset="utf-8">' });
            expect(res.getHeader('x-head-meta')).to.eq(
                Buffer.from('<meta charset="utf-8">', 'utf8').toString('base64'),
            );
        });

        describe('appAssets', () => {
            it('should handle absolute URLs', () => {
                const req = new MockReq(merge({}, defReq));
                const res = new MockRes();

                const pRes = ilcSdk.processRequest(req);
                ilcSdk.processResponse(pRes, res, {
                    appAssets: {
                        spaBundle: 'http://example.com/my.js',
                        cssBundle: 'http://example.com/my.css',
                        dependencies: { react: 'http://cdn.com/react.js' },
                    },
                });
                expect(res.getHeader('Link')).to.eq(
                    [
                        '<http://example.com/my.js>; rel="fragment-script"; as="script"; crossorigin="anonymous"',
                        '<http://example.com/my.css>; rel="stylesheet"',
                        '<http://cdn.com/react.js>; rel="fragment-dependency"; name="react"',
                    ].join(','),
                );
            });

            it('should handle relative URLs using defaultPublicPath', () => {
                const req = new MockReq(merge({}, defReq));
                const res = new MockRes();

                const ilcSdk = new IlcSdk({ logger: fakeCons, publicPath: 'https://tst.com/mypath/' });

                const pRes = ilcSdk.processRequest(req);
                ilcSdk.processResponse(pRes, res, {
                    appAssets: {
                        spaBundle: '/lol/my.js',
                        cssBundle: 'my.css',
                        dependencies: { react: '/react.js' },
                    },
                });
                expect(res.getHeader('Link')).to.eq(
                    [
                        '<https://tst.com/mypath/lol/my.js>; rel="fragment-script"; as="script"; crossorigin="anonymous"',
                        '<https://tst.com/mypath/my.css>; rel="stylesheet"',
                        '<https://tst.com/mypath/react.js>; rel="fragment-dependency"; name="react"',
                    ].join(','),
                );
            });

            it('should handle relative URLs using passed publicPath property', () => {
                const appProps = JSON.stringify({ publicPath: 'https://tst.com/mypath/' });
                const req = new MockReq(
                    merge({}, defReq, {
                        url: `/tst?appProps=${Buffer.from(appProps, 'utf8').toString('base64')}`,
                    }),
                );
                const res = new MockRes();

                const pRes = ilcSdk.processRequest(req);
                ilcSdk.processResponse(pRes, res, {
                    appAssets: {
                        spaBundle: '/lol/my.js',
                        cssBundle: 'my.css',
                        dependencies: { react: '/react.js' },
                    },
                });
                expect(res.getHeader('Link')).to.eq(
                    [
                        '<https://tst.com/mypath/lol/my.js>; rel="fragment-script"; as="script"; crossorigin="anonymous"',
                        '<https://tst.com/mypath/my.css>; rel="stylesheet"',
                        '<https://tst.com/mypath/react.js>; rel="fragment-dependency"; name="react"',
                    ].join(','),
                );
            });

            it('should handle relative URLs using custom passed publicPath property', () => {
                const appProps = JSON.stringify({ assetsPath: 'https://tst.com/mypath/' });
                const req = new MockReq(
                    merge({}, defReq, {
                        url: `/tst?appProps=${Buffer.from(appProps, 'utf8').toString('base64')}`,
                    }),
                );
                const res = new MockRes();

                const ilcSdk = new IlcSdk({ logger: fakeCons, publicPathProperyName: 'assetsPath' });

                const pRes = ilcSdk.processRequest(req);
                ilcSdk.processResponse(pRes, res, {
                    appAssets: {
                        spaBundle: '/lol/my.js',
                        cssBundle: 'my.css',
                        dependencies: { react: '/react.js' },
                    },
                });
                expect(res.getHeader('Link')).to.eq(
                    [
                        '<https://tst.com/mypath/lol/my.js>; rel="fragment-script"; as="script"; crossorigin="anonymous"',
                        '<https://tst.com/mypath/my.css>; rel="stylesheet"',
                        '<https://tst.com/mypath/react.js>; rel="fragment-dependency"; name="react"',
                    ].join(','),
                );
            });

            it('should handle spaBundle only', () => {
                const req = new MockReq(merge({}, defReq));
                const res = new MockRes();

                const pRes = ilcSdk.processRequest(req);
                ilcSdk.processResponse(pRes, res, {
                    appAssets: {
                        spaBundle: '/lol/my.js',
                    },
                });
                expect(res.getHeader('Link')).to.eq(
                    '</lol/my.js>; rel="fragment-script"; as="script"; crossorigin="anonymous"',
                );
            });
        });

        it('should cause an error if headers have already been sent', () => {
            const req = new MockReq(merge({}, defReq));
            const res = new MockRes();
            res.end();

            const pRes = ilcSdk.processRequest(req);
            expect(() => ilcSdk.processResponse(pRes, res, { pageTitle: 'tst' })).to.throw();
        });
    });

    describe('assetsDiscoveryHandler', () => {
        it('should work in minimal setup', () => {
            const req = new MockReq(merge({}, defReq));
            const res = new MockRes();

            ilcSdk.assetsDiscoveryHandler(req, res, {
                spaBundle: 'my.js',
            });
            const resBody = JSON.parse(res._internal.buffer.toString('utf8'));
            expect(resBody).to.eql({ spaBundle: '/my.js', dependencies: {} });
        });

        it('should work with CSS & deps', () => {
            const req = new MockReq(merge({}, defReq));
            const res = new MockRes();

            ilcSdk.assetsDiscoveryHandler(req, res, {
                spaBundle: 'my.js',
                cssBundle: 'my.css',
                dependencies: {
                    react: 'react.js',
                },
            });
            const resBody = JSON.parse(res._internal.buffer.toString('utf8'));
            expect(resBody).to.eql({
                spaBundle: '/my.js',
                cssBundle: '/my.css',
                dependencies: {
                    react: '/react.js',
                },
            });
        });

        it('should correctly handle passed by ILC publicPath property', () => {
            const appProps = JSON.stringify({ publicPath: 'https://tst.com/mypath/' });
            const req = new MockReq(
                merge({}, defReq, {
                    url: `/tst?appProps=${Buffer.from(appProps, 'utf8').toString('base64')}`,
                }),
            );
            const res = new MockRes();

            ilcSdk.assetsDiscoveryHandler(req, res, {
                spaBundle: 'my.js',
                cssBundle: '/tst/my.css',
                dependencies: {
                    react: 'react.js',
                },
            });
            const resBody = JSON.parse(res._internal.buffer.toString('utf8'));
            expect(resBody).to.eql({
                spaBundle: 'https://tst.com/mypath/my.js',
                cssBundle: 'https://tst.com/mypath/tst/my.css',
                dependencies: {
                    react: 'https://tst.com/mypath/react.js',
                },
            });
        });

        it('should correctly handle passed by ILC custom publicPath property', () => {
            const appProps = JSON.stringify({ assetsPath: 'https://tst.com/mypath/' });
            const req = new MockReq(
                merge({}, defReq, {
                    url: `/tst?appProps=${Buffer.from(appProps, 'utf8').toString('base64')}`,
                }),
            );
            const res = new MockRes();

            const ilcSdk = new IlcSdk({ logger: fakeCons, publicPathProperyName: 'assetsPath' });

            ilcSdk.assetsDiscoveryHandler(req, res, {
                spaBundle: 'my.js',
                cssBundle: '/tst/my.css',
                dependencies: {
                    react: 'react.js',
                },
            });
            const resBody = JSON.parse(res._internal.buffer.toString('utf8'));
            expect(resBody).to.eql({
                spaBundle: 'https://tst.com/mypath/my.js',
                cssBundle: 'https://tst.com/mypath/tst/my.css',
                dependencies: {
                    react: 'https://tst.com/mypath/react.js',
                },
            });
        });
    });
});
