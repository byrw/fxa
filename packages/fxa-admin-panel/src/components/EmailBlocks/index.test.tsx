/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import React from 'react';
import Chance from 'chance';
import { render, fireEvent, act } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/react-testing';
import '@testing-library/jest-dom/extend-expect';
import { CLEAR_BOUNCES_BY_EMAIL } from './Account/index';
import { GET_ACCOUNT_BY_EMAIL, EmailBlocks } from './index';

const chance = new Chance();
let testEmail: string;
let testAccountResponse: MockedResponse;
let deleteBouncesMutationCalled = false;

function exampleBounce(email: string) {
  return {
    email: email,
    createdAt: chance.timestamp(),
    bounceType: 'Permanent',
    bounceSubType: 'General',
  };
}

function exampleAccountResponse(email: string): MockedResponse {
  return {
    request: {
      query: GET_ACCOUNT_BY_EMAIL,
      variables: {
        email,
      },
    },
    result: {
      data: {
        accountByEmail: {
          uid: 'a1b2c3',
          email,
          createdAt: chance.timestamp(),
          emailBounces: [exampleBounce(email), exampleBounce(email)],
        },
      },
    },
  };
}

function exampleBounceMutationResponse(email: string): MockedResponse {
  return {
    request: {
      query: CLEAR_BOUNCES_BY_EMAIL,
      variables: {
        email: email,
      },
    },
    result: () => {
      deleteBouncesMutationCalled = true;
      return {
        data: {
          clearEmailBounce: true,
        },
      };
    },
  };
}

beforeAll(function() {
  jest.spyOn(window, 'confirm').mockImplementation(() => true);
});

beforeEach(function() {
  testEmail = chance.email();
  testAccountResponse = exampleAccountResponse(testEmail);
});

it('renders without imploding', () => {
  const renderResult = render(<EmailBlocks />);
  const getByTestId = renderResult.getByTestId;

  expect(getByTestId('form')).toBeInTheDocument();
});

it('displays the loading state on submit', async () => {
  const renderResult = render(
    <MockedProvider mocks={[]}>
      <EmailBlocks />
    </MockedProvider>
  );
  let getByTestId = renderResult.getByTestId;

  fireEvent.change(getByTestId('email'), {
    target: { value: testEmail },
  });
  fireEvent.blur(getByTestId('email'));

  await act(async () => {
    fireEvent.click(getByTestId('button'));
  });

  expect(getByTestId('loading')).toBeInTheDocument();
});

it('displays the account email bounces, and can clear them', async () => {
  const bounceMutationResponse = exampleBounceMutationResponse(testEmail);

  const renderResult = render(
    <MockedProvider
      mocks={[testAccountResponse, bounceMutationResponse]}
      addTypename={false}
    >
      <EmailBlocks />
    </MockedProvider>
  );
  let getByTestId = renderResult.getByTestId;
  let queryAllByTestId = renderResult.queryAllByTestId;

  fireEvent.change(getByTestId('email'), {
    target: { value: testEmail },
  });
  fireEvent.blur(getByTestId('email'));

  await act(async () => {
    fireEvent.click(getByTestId('button'));
  });

  expect(getByTestId('account')).toBeInTheDocument();
  expect(queryAllByTestId('bounce').length).toEqual(2);

  await act(async () => {
    fireEvent.click(getByTestId('clear-button'));
  });
  // account should still be visible
  expect(getByTestId('account')).toBeInTheDocument();
  // but there should be no bounces anymore
  expect(queryAllByTestId('bounce').length).toEqual(0);
  expect(getByTestId('no-bounces')).toBeInTheDocument();
  expect(deleteBouncesMutationCalled).toBe(true);
});

it('displays the error state if theres an error', async () => {
  const erroredAccountResponse = Object.assign({}, testAccountResponse);
  erroredAccountResponse.error = new Error('zoiks');

  const renderResult = render(
    <MockedProvider mocks={[erroredAccountResponse]} addTypename={false}>
      <EmailBlocks />
    </MockedProvider>
  );
  let getByTestId = renderResult.getByTestId;

  fireEvent.change(getByTestId('email'), {
    target: { value: testEmail },
  });
  fireEvent.blur(getByTestId('email'));

  await act(async () => {
    fireEvent.click(getByTestId('button'));
  });

  expect(getByTestId('error')).toBeInTheDocument();
});
