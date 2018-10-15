import * as ynab from 'ynab';
import orderBy from 'lodash/orderBy';
import memoize from 'memoizee';
import moment from 'moment';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default class YnabWrapper {
  constructor(accessToken) {
    this.ynabClient = new ynab.API(accessToken);

    this.fetchBudgets = memoize(this.baseFetchBudgets.bind(this), {
      promise: true,
      maxAge: ONE_DAY_MS
    });
    this.fetchCategories = memoize(this.baseFetchCategories.bind(this), {
      promise: true,
      maxAge: FIVE_MINUTES_MS
    });
    this.fetchAccounts = memoize(this.baseFetchAccounts.bind(this), {
      promise: true,
      maxAge: FIVE_MINUTES_MS
    });
    this.fetchTransactions = memoize(this.baseFetchTransactions.bind(this), {
      promise: true,
      maxAge: FIVE_MINUTES_MS
    });

    this.initialize();
  }

  initialize() {
    this.fetchBudgets.clear();
    this.fetchBudgets().then((budgets) => {
      const [{ id, currency_format }] = budgets;
      this.budgetId = id;
      this.currencySettings = currency_format;
    });
  }

  baseFetchBudgets() {
    return this.ynabClient.budgets
      .getBudgets()
      .then(({ data }) => data)
      .then(({ budgets }) => budgets);
  }

  baseFetchCategories() {
    if (!this.budgetId) {
      return Promise.resolve([]);
    }
    return this.ynabClient.categories
      .getCategories(this.budgetId)
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
  }

  baseFetchAccounts() {
    if (!this.budgetId) {
      return Promise.resolve([]);
    }
    return this.ynabClient.accounts
      .getAccounts(this.budgetId)
      .then(({ data }) => data)
      .then(({ accounts }) =>
        orderBy(accounts, 'on_budget', 'desc').filter(
          ({ deleted, closed }) => !deleted && !closed
        )
      );
  }

  baseFetchTransactions(type, id) {
    if (!this.budgetId) {
      return Promise.resolve([]);
    }
    let getTransactions = (...args) =>
      this.ynabClient.transactions.getTransactions(this.budgetId, ...args);
    if (type === 'category') {
      getTransactions = (...args) =>
        this.ynabClient.transactions.getTransactionsByCategory(
          this.budgetId,
          id,
          ...args
        );
    }
    if (type === 'account') {
      getTransactions = (...args) =>
        this.ynabClient.transactions.getTransactionsByAccount(
          this.budgetId,
          id,
          ...args
        );
    }
    const startOfMonth = moment()
      .startOf('month')
      .format('YYYY-MM-DD');
    return getTransactions(startOfMonth)
      .then(({ data }) => data)
      .then(({ transactions }) =>
        orderBy(transactions, 'date', 'desc')
          .filter(({ deleted }) => !deleted)
          .map((transaction) => ({
            ...transaction,
            dateFormatted: moment(transaction.date).format('MMMM DD, YYYY')
          }))
      );
  }

  formatAmount(amount) {
    const {
      currency_symbol,
      decimal_digits,
      decimal_separator,
      display_symbol,
      group_separator,
      symbol_first
    } = this.currencySettings;

    const isNegative = amount < 0;
    const symbol = display_symbol ? currency_symbol : '';
    const [numeral, decimal] = Math.abs(amount / 1000)
      .toFixed(decimal_digits)
      .split('.');
    const groupedNumeral = numeral
      .split('')
      .reduceRight((value, number, index, { length }) => {
        const indexFromRight = length - index;
        if (indexFromRight > 1 && (indexFromRight - 1) % 3 === 0) {
          return `${number}${group_separator}${value}`;
        }
        return `${number}${value}`;
      }, '');

    let formattedAmount = isNegative ? '-' : '';
    formattedAmount += symbol_first ? symbol : '';
    formattedAmount += groupedNumeral;
    formattedAmount += decimal_separator;
    formattedAmount += decimal;
    formattedAmount += !symbol_first ? symbol : '';
    return formattedAmount;
  }
}
