import orderBy from 'lodash/orderBy';
import * as ynab from 'ynab';
import memoize from 'memoizee';
import moment from 'moment';

import YnabIcon from './YnabIcon.png';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const icon = YnabIcon;
export const name = 'YNAB';
export const keyword = 'ynab';
export const settings = {
  token: { type: 'string' },
  budgetId: { type: 'string' }
};

const subCommands = ['categories', 'accounts', 'transactions'];

let ynabClient;
let budgetId;

const fetchCategories = memoize(
  () => {
    if (!budgetId) {
      return Promise.resolve([]);
    }
    return ynabClient.categories
      .getCategories(budgetId)
      .then(({ data }) => data.category_groups)
      .then((categoryGroups = []) => {
        const allCategories = [];
        categoryGroups
          .filter(({ deleted, hidden }) => !deleted && !hidden)
          .forEach(({ name, categories }) => {
            allCategories.push(
              ...categories
                .filter(({ deleted, hidden }) => !deleted && !hidden)
                .map((category) => ({
                  ...category,
                  groupName: name,
                  fullyQualifiedName: `${name}/${category.name}`
                }))
            );
          });
        return allCategories;
      });
  },
  {
    promise: true,
    maxAge: FIVE_MINUTES_MS
  }
);

const fetchAccounts = memoize(
  () => {
    if (!budgetId) {
      return Promise.resolve([]);
    }
    return ynabClient.accounts
      .getAccounts(budgetId)
      .then(({ data }) => data)
      .then(({ accounts }) =>
        orderBy(accounts, 'on_budget', 'desc').filter(
          ({ deleted, closed }) => !deleted && !closed
        )
      );
  },
  {
    promise: true,
    maxAge: FIVE_MINUTES_MS
  }
);

const fetchTransactions = memoize(
  (type, id) => {
    if (!budgetId) {
      return Promise.resolve([]);
    }
    let getTransactions = (...args) =>
      ynabClient.transactions.getTransactions(budgetId, ...args);
    if (type === 'category') {
      getTransactions = (...args) =>
        ynabClient.transactions.getTransactionsByCategory(
          budgetId,
          id,
          ...args
        );
    }
    if (type === 'account') {
      getTransactions = (...args) =>
        ynabClient.transactions.getTransactionsByAccount(budgetId, id, ...args);
    }
    const startOfMonth = moment()
      .startOf('month')
      .format('YYYY-MM-DD');
    return getTransactions(startOfMonth)
      .then(({ data }) => data)
      .then(({ transactions }) =>
        orderBy(transactions, 'date', 'desc').filter(({ deleted }) => !deleted)
      );
  },
  {
    promise: true,
    maxAge: FIVE_MINUTES_MS
  }
);

export const fn = ({ term, display, hide, settings }) => {
  if (!ynabClient) {
    ynabClient = new ynab.API(settings.token);
  }
  if (!budgetId) {
    ynabClient.budgets.getBudgets().then(({ data: { budgets } }) => {
      [{ id: budgetId }] = budgets;
    });
  }
  const [command, subCommand, ...args] = term.split(/\s+/);
  if (command === keyword && !subCommands.includes(subCommand)) {
    subCommands.forEach((subCommandKeyword) => {
      display({
        icon: YnabIcon,
        title: `${name} ${subCommandKeyword}`,
        term: `${keyword} ${subCommandKeyword}`
      });
    });
  }
  if ('categories' === subCommand) {
    display({
      icon: YnabIcon,
      id: 'loading-categories',
      title: 'Loading Categories...'
    });
    fetchCategories().then((categories = []) => {
      const categoryFilter = args.join(' ');
      const filteredCategoryGroups = categories.filter(
        ({ fullyQualifiedName }) =>
          !categoryFilter ||
          fullyQualifiedName
            .toLowerCase()
            .includes(categoryFilter.toLowerCase())
      );
      hide('loading-categories');
      displayCategories({ display, hide }, filteredCategoryGroups);
    });
  }
  if ('accounts' === subCommand) {
    display({
      icon: YnabIcon,
      id: 'loading-accounts',
      title: 'Loading Accounts...'
    });
    fetchAccounts().then((accounts = []) => {
      const accountFilter = args.join(' ');
      const filteredAccounts = accounts.filter(
        ({ name }) =>
          !accountFilter ||
          name.toLowerCase().includes(accountFilter.toLowerCase())
      );
      hide('loading-accounts');
      displayAccounts({ display, hide }, filteredAccounts);
    });
  }
  if ('transactions' === subCommand) {
    display({
      icon: YnabIcon,
      id: 'loading-transactions',
      title: 'Loading Transactions...'
    });
    fetchTransactions().then((transactions) => {
      const transactionFilter = args.join(' ');
      const filteredTransactions = transactions.filter(
        ({ payee_name }) =>
          !transactionFilter ||
          payee_name.toLowerCase().includes(transactionFilter.toLowerCase())
      );
      hide('loading-transactions');
      displayTransactions({ display }, filteredTransactions);
    });
  }
};

function displayCategories({ display, hide }, categories) {
  categories.forEach(({ fullyQualifiedName, budgeted, balance, activity }) => {
    display({
      icon: YnabIcon,
      title: `Category: ${fullyQualifiedName}`,
      subtitle: `Remaining: ${formatAmount(balance)}  (${formatAmount(
        -activity
      )} / ${formatAmount(budgeted)})`,
      term: `${keyword} categories ${fullyQualifiedName}`
    });
  });
  if (categories.length === 1) {
    display({
      icon: YnabIcon,
      id: 'loading-transactions',
      title: 'Loading Transactions...'
    });
    fetchTransactions('category', categories[0].id).then((transactions) => {
      hide('loading-transactions');
      displayTransactions({ display }, transactions);
    });
  }
}

function displayAccounts({ display, hide }, accounts) {
  accounts.forEach(({ name, balance }) => {
    const formattedBalance = formatAmount(balance);
    display({
      icon: YnabIcon,
      title: `Account: ${name}`,
      subtitle: formattedBalance,
      term: `${keyword} accounts ${name}`
    });
  });
  if (accounts.length === 1) {
    display({
      icon: YnabIcon,
      id: 'loading-transactions',
      title: 'Loading Transactions...'
    });
    fetchTransactions('account', accounts[0].id).then((transactions) => {
      hide('loading-transactions');
      displayTransactions({ display }, transactions);
    });
  }
}

function displayTransactions({ display }, transactions) {
  transactions.forEach(({ payee_name, amount }) => {
    const formattedBalance = formatAmount(amount);
    display({
      icon: YnabIcon,
      title: `Transaction: ${payee_name}`,
      subtitle: formattedBalance
    });
  });
}

function formatAmount(amount) {
  const isNegative = amount < 0;
  return `${isNegative ? '-' : ''}\$${Math.abs(amount / 1000).toFixed(2)}`;
}
