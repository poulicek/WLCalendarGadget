using System;
using System.Collections.Generic;
using System.Configuration;
using System.Windows;

namespace WLCalendarReminder
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            Reminder.Args = e.Args;
        }
    }
}
