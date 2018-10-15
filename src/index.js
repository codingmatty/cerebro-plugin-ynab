import React from 'react';
import captitalize from 'lodash/capitalize';
import startCase from 'lodash/startCase';
import YnabWrapper from './ynab-wrapper';
import YnabIcon from './YnabIcon.png';
import Progress from './Components/Progress.jsx';
import List from './Components/List.jsx';

export const icon = YnabIcon;
export const name = 'YNAB';
export const keyword = 'ynab';
export const settings = {
  token: { label: 'Access Token', type: 'string' }
};

const subCommands = ['categories', 'accounts', 'transactions'];

let ynab;

export const fn = ({ term, display, hide, settings }) => {
  const [command, subCommand, ...args] = term.toLowerCase().split(/\s+/);
  if (command !== keyword) {
    return;
  }

  if (!settings.token) {
    display({
      icon: YnabIcon,
      title: 'Please Initialize Plugin Before Use',
      subtitle: 'Press Tab to go to YNAB Plusing Settings',
      term: 'plugins ynab'
    });
    return;
  }
  if (!ynab) {
    ynab = new YnabWrapper(settings.token);
  }
  if (!ynab.budgetId) {
    ynab.initialize();
  }

  if (!subCommands.includes(subCommand)) {
    subCommands.forEach((subCommandKeyword) => {
      display({
        icon: YnabIcon,
        title: `${name} ${captitalize(subCommandKeyword)}`,
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
    ynab.fetchCategories().then((categories = []) => {
      const categoryFilter = args.join(' ');
      const filteredCategoryGroups = categories.filter(
        ({ fullyQualifiedName }) =>
          !categoryFilter ||
          fullyQualifiedName.toLowerCase().includes(categoryFilter)
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
    ynab.fetchAccounts().then((accounts = []) => {
      const accountFilter = args.join(' ');
      const filteredAccounts = accounts.filter(
        ({ name }) =>
          !accountFilter || name.toLowerCase().includes(accountFilter)
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
    ynab.fetchTransactions().then((transactions) => {
      const transactionFilter = args.join(' ');
      const filteredTransactions = transactions.filter(
        ({ payee_name, memo }) =>
          !transactionFilter ||
          payee_name.toLowerCase().includes(transactionFilter) ||
          (memo && memo.toLowerCase().includes(transactionFilter))
      );
      hide('loading-transactions');
      displayTransactions({ display }, filteredTransactions, {
        displayTotal: !!transactionFilter
      });
    });
  }
};

function displayCategories({ display, hide }, categories) {
  categories.forEach(({ fullyQualifiedName, budgeted, balance, activity }) => {
    display({
      icon: YnabIcon,
      title: `Category: ${fullyQualifiedName}`,
      subtitle: `Remaining: ${ynab.formatAmount(balance)}  (${ynab.formatAmount(
        -activity
      )} / ${ynab.formatAmount(budgeted)})`,
      term: `${keyword} categories ${fullyQualifiedName}`,
      getPreview: () => (
        <div>
          <Progress percent={-activity / budgeted} />
          <List
            values={[
              'Remaining:',
              ynab.formatAmount(balance),
              'Activity:',
              ynab.formatAmount(activity),
              'Budgeted:',
              ynab.formatAmount(budgeted)
            ]}
          />
        </div>
      )
    });
  });
  if (categories.length === 1) {
    display({
      icon: YnabIcon,
      id: 'loading-transactions',
      title: 'Loading Transactions...'
    });
    ynab
      .fetchTransactions('category', categories[0].id)
      .then((transactions) => {
        hide('loading-transactions');
        displayTransactions({ display }, transactions);
      });
  }
}

function displayAccounts({ display, hide }, accounts) {
  accounts.forEach(
    ({
      name,
      balance,
      cleared_balance,
      uncleared_balance,
      type,
      on_budget
    }) => {
      const formattedBalance = ynab.formatAmount(balance);
      display({
        icon: YnabIcon,
        title: `Account: ${name}`,
        subtitle: formattedBalance,
        term: `${keyword} accounts ${name}`,
        getPreview: () => (
          <List
            values={[
              'Account:',
              name,
              'Balance:',
              formattedBalance,
              'Cleared Balanced:',
              ynab.formatAmount(cleared_balance),
              'Uncleared Amount:',
              ynab.formatAmount(uncleared_balance),
              'Type:',
              startCase(type),
              'On Budget:',
              captitalize(Boolean(on_budget).toString())
            ]}
          />
        )
      });
    }
  );
  if (accounts.length === 1) {
    display({
      icon: YnabIcon,
      id: 'loading-transactions',
      title: 'Loading Transactions...'
    });
    ynab.fetchTransactions('account', accounts[0].id).then((transactions) => {
      hide('loading-transactions');
      displayTransactions({ display }, transactions);
    });
  }
}

function displayTransactions(
  { display },
  transactions,
  { displayTotal = false } = {}
) {
  if (displayTotal) {
    const formattedAmountSum = ynab.formatAmount(
      transactions.reduce((sum, { amount }) => sum + amount, 0)
    );
    display({
      icon: YnabIcon,
      title: `Transaction Search Sum`,
      subtitle: formattedAmountSum
    });
  }
  transactions.forEach(
    ({
      payee_name,
      amount,
      dateFormatted,
      category_name,
      account_name,
      memo
    }) => {
      const formattedAmount = ynab.formatAmount(amount);
      display({
        icon: YnabIcon,
        title: `Transaction: ${payee_name}`,
        subtitle: formattedAmount,
        getPreview: () => (
          <List
            values={[
              'Date:',
              dateFormatted,
              'Payee:',
              payee_name,
              'Amount:',
              formattedAmount,
              'Category:',
              category_name,
              'Account:',
              account_name,
              'Memo:',
              memo
            ]}
          />
        )
      });
    }
  );
}
