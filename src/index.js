import YnabWrapper from './ynab-wrapper';
import YnabIcon from './YnabIcon.png';

export const icon = YnabIcon;
export const name = 'YNAB';
export const keyword = 'ynab';
export const settings = {
  token: { label: 'Access Token', type: 'string' }
};

const subCommands = ['categories', 'accounts', 'transactions'];

let ynab;

export const fn = ({ term, display, hide, settings }) => {
  if (!settings.token) {
    display({
      icon: YnabIcon,
      title: 'Please Initialize Plugin Before Use',
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
    ynab.fetchCategories().then((categories = []) => {
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
    ynab.fetchAccounts().then((accounts = []) => {
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
    ynab.fetchTransactions().then((transactions) => {
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
      subtitle: `Remaining: ${ynab.formatAmount(balance)}  (${ynab.formatAmount(
        -activity
      )} / ${ynab.formatAmount(budgeted)})`,
      term: `${keyword} categories ${fullyQualifiedName}`
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
  accounts.forEach(({ name, balance }) => {
    const formattedBalance = ynab.formatAmount(balance);
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
    ynab.fetchTransactions('account', accounts[0].id).then((transactions) => {
      hide('loading-transactions');
      displayTransactions({ display }, transactions);
    });
  }
}

function displayTransactions({ display }, transactions) {
  transactions.forEach(({ payee_name, amount }) => {
    const formattedBalance = ynab.formatAmount(amount);
    display({
      icon: YnabIcon,
      title: `Transaction: ${payee_name}`,
      subtitle: formattedBalance
    });
  });
}
