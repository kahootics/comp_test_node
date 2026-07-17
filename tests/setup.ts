import { expect, type MatcherResult } from 'vitest';
import type { MatcherState } from '@vitest/expect';
import { IllegalArgumentError } from '../src/errors/common-errors.js';

export type dummy = never;

declare module 'vitest' {
    interface Assertion<T = any> extends CustomMatchers<T> {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
}

interface CustomMatchers<R = unknown> {
    toThrowWithName(expected: string): R;
	toThrowInstanceof(expected: new (...args: any[]) => Error): R;
}

expect.extend({ toThrowWithName, toThrowInstanceof });

/**
 * 
 * @param this 
 * @param received 
 * @param expectedErrorName 
 * @returns 
 */
function toThrowWithName(this: MatcherState, received: () => unknown, expectedErrorName: string): MatcherResult {
	const {isNot} = this;
	if(typeof received !== 'function')
		throw new IllegalArgumentError("Can only accept functions");


	let result: boolean = false;
	let didThrow: boolean = false;
	let actualName: string | undefined;
	try {
		received();
	} catch(e) {
		didThrow = true;
		if(e instanceof Error || e instanceof DOMException) {
			actualName = e.name;
			result = actualName === expectedErrorName
		}
	}
  	return {
    	pass: result,
    	message: () => 
      			didThrow
        	? `Expected error name ${isNot ? 'not ' : ''}to be "${expectedErrorName}", but got "${actualName}"`
        	: `Expected function to throw, but it didn't`,
    	actual: actualName,
    	expected: expectedErrorName,
  	};
}

function toThrowInstanceof<E extends Error>(this: MatcherState, received: () => unknown, ExpectedErrorType: new (...args: any[]) => E ): MatcherResult {
	const {isNot} = this;
	if(typeof received !== 'function')
		throw new IllegalArgumentError("Can only accept functions");

	let result: boolean = false;
	let didThrow: boolean = false;
	let actualName: string | undefined;
	try {
		received();
	} catch(e) {
		didThrow = true;
		if(e instanceof Error) {
			actualName = e.name;
		}
		if(e instanceof ExpectedErrorType) {
			result = true;
		}
	}
  	return {
    	pass: result,
    	message: () => 
      			didThrow
        	? `Expected error ${isNot ? 'not ' : ''}to be instance of "${ExpectedErrorType.name}", but got "${actualName}"`
        	: `Expected function to throw, but it didn't`,
    	actual: actualName,
    	expected: ExpectedErrorType.name,
  	};
}




