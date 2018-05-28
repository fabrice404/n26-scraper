const cheerio = require('cheerio');
const { Builder, By, until } = require('selenium-webdriver');

const defaultConfig = {
  url: 'https://my.n26.com/',
  browser: 'chrome',
};

module.exports = {
  get: async (_config) => {
    const config = Object.assign(defaultConfig, _config);
    const driver = new Builder()
      .forBrowser(config.browser)
      .build();

    const getElement = async (selector) => {
      const by = selector.startsWith('/') ? By.xpath(selector) : By.id(selector);
      await driver.wait(until.elementLocated(by));
      return driver.wait(until.elementIsVisible(driver.findElement(by)));
    };

    const getContent = async (selector) => {
      const element = await getElement(selector);
      return element.getAttribute('innerHTML');
    };

    const getAmountFromText = text => parseFloat(text.replace(/[^0-9.-]/g, ''));

    const click = async (selector) => {
      const element = await getElement(selector);
      await element.click();
    };

    const result = [];
    try {
      // navigate to url
      await driver.get(config.url);

      // wait for log in button visibility
      await getElement('//a[contains(@class, "login")]');

      // set login and password inputs values
      await driver.executeScript((login, password) => {
        document.getElementsByName('email')[0].value = login;
        document.getElementsByName('password')[0].value = password;
      }, config.login, config.password);

      // click log in button
      click('//a[contains(@class, "login")]');

      // wait for account summary visibility
      await getElement('//div[@class = "UIActivities"]');

      // get data and convert it
      const data = await getContent('//div[contains(@class, "UISkeleton")]');
      const $ = cheerio.load(data);

      const balance = getAmountFromText($('.UIHeader__account-balance').text());
      const account = {
        name: 'N26',
        balance,
        available: balance,
        transactions: { done: [], pending: [] },
      };
      $('.node.activity').each((i, row) => {
        const transaction = {
          date: parseInt($(row).attr('data-timestamp'), 10),
          name: $(row).find('h4').text().trim(),
          amount: getAmountFromText($(row).find('.expense').text()),
          reference: $(row).attr('data-linkid'),
        };

        if ($(row).attr('data-type') === 'AA') {
          account.transactions.pending.push(transaction);
        } else {
          account.transactions.done.push(transaction);
        }
      });
      result.push(account);

      if (!config.keepItOpen) {
        driver.quit();
      }
    } catch (ex) {
      throw ex;
    }
    return result;
  },
};
